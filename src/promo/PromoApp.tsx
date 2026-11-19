import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Gamepad2,
  Layers,
  Search,
  Shield,
  Sparkles,
  Swords,
  Trophy,
  X,
} from 'lucide-react';
import {
  CLASS_CREST_URL,
  CRAFTING_COST,
  DISENCHANT_VALUE,
  compareCardsStoneOrder,
  formatCardHtmlText,
  getCardBaseDurability,
} from '../hearthstone/cardDb';
import {
  SNS_CARD_BACK_THEMES,
  SNS_LOCATIONS,
  getSnsLogoUrl,
  SnsBoosterPackArt,
} from '../hearthstone/components/SnsHeroArtKit';
import { KadanChatbotWidget } from '../hearthstone/components/KadanChatbotWidget';
import { HowToPlayCarousel } from '../hearthstone/components/OnboardingGuideModal';
import { SharedAdSenseShell } from '../components/SharedAdSenseShell';
import { hsAudio } from '../hearthstone/audio';
import { playFactionChord, playRhythmCue } from '../hearthstone/services/rhythmCueEngine';
import { appendAttributionToGameUrl, trackHeroEvent } from '../hearthstone/services/analyticsEvents';
import { hsStorage } from '../hearthstone/storage';
import { resolveDialogueSpriteUrl } from '../hearthstone/storyEncounterData';
import {
  CARD_CLASS_LABELS_EN,
  getCardCharName,
  getCardFactionLabel,
  getCardFlavor,
  getCardName,
  getCardText,
  getLocalizedHeroInfo,
} from '../hearthstone/i18nData';
import {
  CLASSIC_HEROES,
  CardRarity,
  ClassicCardDef,
  HERO_CLASS_ORDER,
  HeroClass,
} from '../hearthstone/types';
import { getLanguageMeta, HERO_LANGUAGES, tr, useHeroLanguage } from '../i18n/heroLang';
import { PromoCard, getPromoRaceLabel, getPromoRarityLabel } from './PromoCard';

type FeatureTabId = 'story' | 'awake' | 'pack';

const YOUTUBE_PLAYLIST_URL_KO = 'https://www.youtube.com/playlist?list=PLVch67W9z4TA';
const YOUTUBE_PLAYLIST_URL_EN = 'https://www.youtube.com/playlist?list=PLFvV2raCoFww';

export const PromoApp: React.FC = () => {
  const { lang, setLang } = useHeroLanguage();
  const isKo = lang === 'ko';
  const [langMenuOpen, setLangMenuOpen] = useState(false);

  const [cards, setCards] = useState<ClassicCardDef[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [promoAutoRunning, setPromoAutoRunning] = useState(false);
  const [promoProfile] = useState(() => {
    hsStorage.ensureInitialized();
    return hsStorage.getProfile();
  });
  const [selectedHeroClass, setSelectedHeroClass] = useState<HeroClass>('PRIEST');
  const [activeFeatureTab, setActiveFeatureTab] = useState<FeatureTabId>('story');

  // Trailer controls (Click-to-Play Facade)
  const [activeClipIdx, setActiveClipIdx] = useState(0);
  const [trailerFacadePlaying, setTrailerFacadePlaying] = useState(false);

  // Card Library Filters (All 382 Cards visible & searchable directly)
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterRarity, setFilterRarity] = useState<string>('ALL');
  const [filterMana, setFilterMana] = useState<number | 'ALL'>('ALL');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGolden, setShowGolden] = useState(false);
  const [showAwakened3x, setShowAwakened3x] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [zoomedCard, setZoomedCard] = useState<ClassicCardDef | null>(null);
  const [rhythmPreviewMsg, setRhythmPreviewMsg] = useState<string | null>(null);

  // Pre-Game Free Pack Modal & Ep.1 Mini Theater Modal
  const [promoPackModalOpen, setPromoPackModalOpen] = useState(false);
  const [promoPackCards, setPromoPackCards] = useState<
    { card: ClassicCardDef; isGolden: boolean }[] | null
  >(null);
  const [mediaTheaterOpen, setMediaTheaterOpen] = useState(false);

  const handleOpenPromoPrePack = () => {
    if (cards.length === 0) return;
    hsAudio.playSfx('zelda_chest_open', 0.85);
    const savedRaw =
      localStorage.getItem('snshero_showcase_drawn_cards') ||
      localStorage.getItem('hero_hs_promo_pack');
    if (savedRaw) {
      try {
        const parsed = JSON.parse(savedRaw) as { id: string; isGolden: boolean }[];
        if (Array.isArray(parsed) && parsed.length === 5) {
          const restored = parsed
            .map((item) => {
              const found = cards.find((c) => c.id === item.id);
              return found ? { card: found, isGolden: Boolean(item.isGolden) } : null;
            })
            .filter(Boolean) as { card: ClassicCardDef; isGolden: boolean }[];
          if (restored.length === 5) {
            setPromoPackCards(restored);
            setPromoPackModalOpen(true);
            return;
          }
        }
      } catch {
        // ignore malformed cache
      }
    }

    const collectible = cards.filter((c) => c.rarity !== 'FREE');
    const byRarity: Record<string, ClassicCardDef[]> = {
      COMMON: collectible.filter((c) => c.rarity === 'COMMON'),
      RARE: collectible.filter((c) => c.rarity === 'RARE'),
      EPIC: collectible.filter((c) => c.rarity === 'EPIC'),
      LEGENDARY: collectible.filter((c) => c.rarity === 'LEGENDARY'),
    };
    const pickFrom = (rar: string) => {
      const pool = byRarity[rar]?.length ? byRarity[rar] : collectible;
      return pool[Math.floor(Math.random() * pool.length)];
    };
    const rarities = [
      'RARE',
      Math.random() < 0.35 ? 'EPIC' : 'COMMON',
      Math.random() < 0.18 ? 'LEGENDARY' : 'RARE',
      'COMMON',
      'COMMON',
    ];
    const drawn = rarities.map((rar, idx) => ({
      card: pickFrom(rar),
      isGolden: idx === 2 ? Math.random() < 0.25 : Math.random() < 0.08,
    }));
    const serialized = JSON.stringify(
      drawn.map((d) => ({ id: d.card.id, isGolden: d.isGolden })),
    );
    try {
      localStorage.setItem('snshero_showcase_drawn_cards', serialized);
      localStorage.setItem('hero_hs_promo_pack', serialized);
    } catch {
      // ignore quota error
    }
    setPromoPackCards(drawn);
    setPromoPackModalOpen(true);
  };

  useEffect(() => {
    document.documentElement.lang = getLanguageMeta(lang).htmlLang;
    document.title = tr(
      '눈히어로 : 카단의 여정 (SNSHero) — 무설치 382종 판타지 전략 웹 TCG',
      'SNSHero : Heroes of Elwin Village — 382-Card Tactical Web TCG',
    );
  }, [lang]);

  useEffect(() => {
    fetch('/hs-assets/data/classic-cards.json')
      .then((res) => res.json())
      .then((json: { cards?: ClassicCardDef[] }) => {
        if (Array.isArray(json.cards)) {
          setCards(json.cards);
        }
      })
      .catch(() => {
        // graceful fallback
      })
      .finally(() => setCardsLoading(false));
  }, []);

  const featureTabs: {
    id: FeatureTabId;
    title: string;
    eyebrow: string;
    headline: string;
    desc: string;
    imageUrl: string;
    ctaText: string;
    ctaHref: string;
  }[] = useMemo(
    () => [
      {
        id: 'story',
        title: tr('40화 풀보이스 스토리', '40-EP Voiced Story'),
        eyebrow: tr('카단의 여정', "Kadan's Journey"),
        headline: tr(
          '5컷 웹툰 극장 & 40화 보스 레이드',
          '5-Panel Webtoon Theater & 40 Boss Raids',
        ),
        desc: tr(
          '매 화 성우 내레이션과 웹툰 연출을 감상하고 원작 적장들과 대결하세요. 5화마다 보스 카드팩이 지급되며 40화 완주 시 무한 환생 모드가 열립니다.',
          'Enjoy studio-voiced webtoon cutscenes before every boss duel. Earn bonus Card Packs every 5 episodes and unlock Infinite Reincarnation at Episode 40.',
        ),
        imageUrl: '/hs-assets/screenshots/ingame_story_theater.png?v=20261116',
        ctaText: tr('스토리모드 시작', 'Play Story Mode'),
        ctaHref: '/game?mode=story&ep=1&theater=on',
      },
      {
        id: 'awake',
        title: tr('3장 = 3배 각성', '3 Copies = 3x Power'),
        eyebrow: tr('여정 전용 성장 법칙', 'Story-Only Scaling'),
        headline: tr(
          '동일 카드 3장 보유 시 공·체 3배 폭증',
          'Hold 3+ Copies for 3x Attack & Health',
        ),
        desc: tr(
          '스토리모드에서는 중복 카드를 3장 이상 모으면 공격력과 생명력이 보유 장수 배율(×3, ×4)로 강화됩니다. 랭킹전·도박장은 공정한 1배 룰로 진행됩니다.',
          'In Story Mode, owning 3+ copies multiplies minion & weapon stats (3x, 4x) to break through tough bosses, while Ranked & Bogart keep fair 1x rules.',
        ),
        imageUrl: '/hs-assets/screenshots/ingame_collection_awake.png?v=20261116',
        ctaText: tr('내 카드첩 보기', 'Open Collection'),
        ctaHref: '/game?mode=collection',
      },
      {
        id: 'pack',
        title: tr('382종 & 전설 천장', '382 Cards & Pity'),
        eyebrow: tr('9종족 225장 + 중립 157장', '9 Factions + Neutral'),
        headline: tr(
          '첫 10팩 내 전설 확정 & 24K 황금 포일',
          'Legendary in First 10 Packs & 24K Foil',
        ),
        desc: tr(
          '신규 접속 즉시 무료 3팩이 지급되며 첫 10팩 이내 첫 전설 카드가 100% 확정됩니다. 여분 카드는 가루로 추출해 원하는 전설을 직접 제작하세요.',
          'Start with 3 Free Packs and a guaranteed Legendary within your first 10 packs. Disenchant extras into Dust to craft any card you want.',
        ),
        imageUrl: '/hs-assets/screenshots/ingame_pack_altar.png?v=20261116',
        ctaText: tr('무료 3팩 개봉하기', 'Open 3 Free Packs'),
        ctaHref: '/game',
      },
    ],
    [lang],
  );

  const youtubePlaylistUrl = isKo ? YOUTUBE_PLAYLIST_URL_KO : YOUTUBE_PLAYLIST_URL_EN;

  const trailerClips = useMemo(
    () =>
      isKo
        ? [
            {
              id: 'ep1',
              label: '제1화',
              youtubeId: 'KOf8IAic2QY',
            },
            {
              id: 'ep8',
              label: '제8화',
              youtubeId: 'BIHe4MrtCIw',
            },
            {
              id: 'ep15',
              label: '제15화',
              youtubeId: 'LHHngbtkJwg',
            },
          ]
        : [
            {
              id: 'ep1',
              label: 'EP.1',
              youtubeId: 'q6-w_dz8Hbs',
            },
            {
              id: 'ep8',
              label: 'EP.8',
              youtubeId: 'GQ3_HDM-bW8',
            },
            {
              id: 'ep15',
              label: 'EP.15',
              youtubeId: 'qFsQnrjnv4E',
            },
          ],
    [isKo],
  );

  const selectedHero = CLASSIC_HEROES[selectedHeroClass];
  const selectedHeroUi = getLocalizedHeroInfo(selectedHeroClass, lang);

  const heroSignatureCards = useMemo(() => {
    const clsCards = cards.filter((c) => c.cardClass === selectedHeroClass);
    const ranked = [...clsCards].sort((a, b) => {
      const order: Record<CardRarity, number> = {
        LEGENDARY: 0,
        EPIC: 1,
        RARE: 2,
        COMMON: 3,
        FREE: 4,
      };
      return order[a.rarity] - order[b.rarity] || b.cost - a.cost;
    });
    return ranked.slice(0, 3);
  }, [cards, selectedHeroClass]);

  const filteredCards = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    const isDefaultUnfiltered =
      filterClass === 'ALL' && filterRarity === 'ALL' && filterMana === 'ALL' && !q;
    return cards
      .filter((c) => {
        if (filterClass !== 'ALL' && c.cardClass !== filterClass) return false;
        if (filterRarity !== 'ALL' && c.rarity !== filterRarity) return false;
        if (filterMana !== 'ALL') {
          if (filterMana === 7 ? c.cost < 7 : c.cost !== filterMana) return false;
        }
        if (q) {
          const hay = [
            c.name,
            c.nameEn,
            c.text,
            c.textEn,
            c.snsCharName,
            c.snsCharNameEn,
            c.snsFactionKo,
            c.snsFactionEn,
          ]
            .filter(Boolean)
            .join(' ')
            .toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (isDefaultUnfiltered) {
          const aChamp =
            a.rarity === 'LEGENDARY' && a.cardClass !== 'NEUTRAL' && (a.attack || 0) >= 3
              ? 0
              : a.rarity === 'LEGENDARY' && (a.attack || 0) >= 4
                ? 1
                : 2;
          const bChamp =
            b.rarity === 'LEGENDARY' && b.cardClass !== 'NEUTRAL' && (b.attack || 0) >= 3
              ? 0
              : b.rarity === 'LEGENDARY' && (b.attack || 0) >= 4
                ? 1
                : 2;
          if (aChamp !== bChamp) return aChamp - bChamp;
        }
        return compareCardsStoneOrder(a, b);
      });
  }, [cards, filterClass, filterRarity, filterMana, searchQuery]);

  const displayedCards = useMemo(
    () => filteredCards.slice(0, visibleLimit),
    [filteredCards, visibleLimit],
  );

  const activeFeature =
    featureTabs.find((item) => item.id === activeFeatureTab) || featureTabs[0];
  const activeClip = trailerClips[activeClipIdx] || trailerClips[0];

  const getZoomedCardClassLabel = (card: ClassicCardDef) => {
    if (card.cardClass !== 'NEUTRAL' && card.cardClass !== 'DREAM') {
      if (isKo) return CLASSIC_HEROES[card.cardClass as HeroClass].classNameKo;
      return CARD_CLASS_LABELS_EN[card.cardClass] || card.cardClass;
    }
    return isKo ? '중립 카드' : 'Neutral';
  };

  return (
    <SharedAdSenseShell pageKey="promo" theme="tavern">
      <div className="min-h-screen w-full bg-[#120b06] text-[#f8ebd2]">
        {/* Mobile AdSense Safe Buffer (>= 32px separation above interactive header) */}
        <div aria-hidden="true" className="h-5 w-full bg-[#120b06] sm:hidden" />

        {/* =====================================================================
            1. Clean Sticky Header
        ===================================================================== */}
        <header className="hs-promo-nav sticky top-0 z-50 w-full">
          <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[68px] sm:px-6">
            <a href="#hero" className="flex items-center gap-2.5 group">
              <img
                src={getSnsLogoUrl(lang)}
                alt={tr('눈히어로', 'SNSHero')}
                className="h-10 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] transition-transform group-hover:scale-105 sm:h-12"
              />
            </a>

            <nav className="hidden items-center gap-5 text-xs font-extrabold text-amber-100/85 lg:flex">
              <a href="#intro" className="hover:text-amber-300">
                {tr('세계관', 'World')}
              </a>
              <a href="#latest" className="hover:text-amber-300">
                {tr('핵심 시스템', 'Systems')}
              </a>
              <a href="#how-to-play" className="hover:text-amber-300">
                {tr('게임 방법', 'How to Play')}
              </a>
              <a href="#heroes" className="hover:text-amber-300">
                {tr('9대 종족', '9 Heroes')}
              </a>
              <a href="#cards" className="hover:text-amber-300">
                {tr('382 카드 도감', '382 Cards')}
              </a>
              <a href="#modes" className="hover:text-amber-300">
                {tr('게임 모드', 'Modes')}
              </a>
              <a href="#universe" className="hover:text-amber-300">
                {tr('웹소설·웹툰', 'Universe')}
              </a>
            </nav>

            <div className="flex items-center gap-2 sm:gap-2.5">
              <div className="relative">
                <button
                  type="button"
                  data-testid="header-lang-toggle"
                  aria-expanded={langMenuOpen}
                  aria-label={tr('언어 선택', 'Select Language')}
                  onClick={() => setLangMenuOpen((prev) => !prev)}
                  className="inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border border-amber-400/40 bg-black/55 px-3 py-1.5 text-xs font-extrabold text-amber-100 transition hover:border-amber-300/70 hover:bg-black/75"
                >
                  <span aria-hidden="true" className="text-sm leading-none">
                    {getLanguageMeta(lang).flag}
                  </span>
                  <span>{getLanguageMeta(lang).shortLabel}</span>
                  <span aria-hidden="true" className="text-[10px] text-amber-300/80">
                    {langMenuOpen ? '▲' : '▼'}
                  </span>
                </button>
                {langMenuOpen && (
                  <>
                    <div
                      className="fixed inset-0 z-40"
                      onClick={() => setLangMenuOpen(false)}
                    />
                    <div
                      data-testid="header-lang-menu"
                      className="absolute right-0 z-50 mt-2 grid w-64 grid-cols-2 gap-1 rounded-2xl border border-amber-400/40 bg-[#1a130e]/95 p-2 shadow-2xl backdrop-blur-md"
                    >
                      {HERO_LANGUAGES.map((item) => {
                        const active = lang === item.code;
                        return (
                          <button
                            key={item.code}
                            type="button"
                            data-testid={`header-lang-${item.code}`}
                            onClick={() => {
                              setLang(item.code);
                              setLangMenuOpen(false);
                            }}
                            className={`flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-xl px-2.5 py-1.5 text-left text-xs font-extrabold transition ${
                              active
                                ? 'bg-amber-400 text-[#1b120b] shadow-sm'
                                : 'text-amber-100/85 hover:bg-white/10 hover:text-amber-100'
                            }`}
                          >
                            <span aria-hidden="true" className="text-sm leading-none">
                              {item.flag}
                            </span>
                            <span className="truncate">{item.nativeName}</span>
                          </button>
                        );
                      })}
                    </div>
                  </>
                )}
              </div>
              <a
                href={appendAttributionToGameUrl('/game')}
                data-testid="header-play-now-btn"
                onClick={() => trackHeroEvent('hero_promo_cta_click', { cta_id: 'header_play_now', lang })}
                className="hs-promo-cta-purple inline-flex min-h-[44px] items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold tracking-wide sm:px-6 sm:text-sm"
              >
                <span>{tr('바로 플레이', 'Play Now')}</span>
                <ChevronRight className="h-4 w-4" />
              </a>
            </div>
          </div>
        </header>

        {/* =====================================================================
            2. Hero Banner
        ===================================================================== */}
        <section
          id="hero"
          style={{ backgroundImage: `url(${SNS_LOCATIONS.TAVERN_EXTERIOR})` }}
          className="relative flex min-h-[460px] w-full items-center justify-center overflow-hidden bg-cover bg-center px-4 py-14 sm:min-h-[540px] sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at 50% 44%, rgba(251, 191, 36, 0.18) 0%, rgba(20, 11, 5, 0.74) 55%, rgba(10, 6, 3, 0.96) 100%)',
            }}
          />

          <img
            src={resolveDialogueSpriteUrl(CLASSIC_HEROES.PRIEST.heroCutoutUrl)}
            alt=""
            aria-hidden="true"
            decoding="async"
            className="pointer-events-none absolute -left-12 bottom-0 h-[210px] w-auto object-contain opacity-25 sm:-left-10 sm:h-[290px] sm:opacity-55 lg:-left-6 lg:h-[380px] lg:opacity-90"
          />
          <img
            src={resolveDialogueSpriteUrl('/hs-assets/characters/cutouts/011_Ignis.webp')}
            alt=""
            aria-hidden="true"
            decoding="async"
            className="pointer-events-none absolute -right-12 bottom-0 h-[210px] w-auto object-contain opacity-25 sm:-right-10 sm:h-[290px] sm:opacity-55 lg:-right-6 lg:h-[380px] lg:opacity-90"
          />

          <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
            <img
              src={getSnsLogoUrl(lang)}
              alt=""
              aria-hidden="true"
              className="mb-3 w-[240px] max-w-[76vw] drop-shadow-[0_14px_28px_rgba(0,0,0,0.95)] sm:w-[360px]"
            />

            <h1 className="promo-outline break-keep text-2xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
              {isKo
                ? '눈히어로 : 카단의 여정'
                : 'SNSHero : Heroes of Elwin Village'}
            </h1>

            <p className="promo-outline mt-2.5 max-w-xl text-sm font-bold leading-relaxed text-amber-100/95 sm:text-base">
              {tr(
                '설치 없는 382종 판타지 전략 웹 TCG · 첫 접속 무료 3팩 + 250골드 즉시 지급',
                'Zero-Install 382-Card Fantasy Web TCG · Claim 3 Free Packs + 250 Gold Instantly',
              )}
            </p>

            <div
              data-testid="promo-3s-dopamine-hooks"
              className="mt-3 flex flex-wrap items-center justify-center gap-2 text-[11px] font-extrabold sm:text-xs"
            >
              <a
                href={appendAttributionToGameUrl('/game?mode=story&ep=1&theater=on')}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-amber-300/65 bg-amber-950/80 px-3 py-1 text-amber-100 shadow transition hover:border-yellow-200 hover:bg-amber-900/90"
              >
                <span>⚡</span>
                <span>
                  {tr(
                    '같은 카드 3장 = 공·체 3배 폭증(×3·×4) 보스 원킬',
                    '3 Copies = 3x Attack & HP Awakening Boss Kill',
                  )}
                </span>
              </a>
              <a
                href={appendAttributionToGameUrl('/game?mode=bogart')}
                className="inline-flex min-h-[36px] items-center gap-1 rounded-full border border-rose-300/60 bg-rose-950/80 px-3 py-1 text-rose-100 shadow transition hover:border-rose-200 hover:bg-rose-900/90"
              >
                <span>🎲</span>
                <span>
                  {tr(
                    '100% 랜덤 30장 덱 · 보가트 도박장 판돈 2배',
                    "100% Random 30-Card Deck · Bogart's Hall 2x Gold",
                  )}
                </span>
              </a>
            </div>

            <div
              data-testid="promo-hero-cta-pair"
              className="mt-6 flex flex-wrap items-center justify-center gap-3"
            >
              <a
                href={appendAttributionToGameUrl('/game?open=pack3')}
                data-testid="promo-hero-primary-cta"
                onClick={() => trackHeroEvent('hero_promo_cta_click', { cta_id: 'hero_primary_play', lang })}
                className="hs-promo-cta-purple inline-flex min-h-[52px] items-center gap-2 rounded-full px-8 py-3 text-base font-extrabold tracking-wide sm:text-lg"
              >
                <Gamepad2 className="h-5 w-5" />
                <span>{tr('지금 무료로 플레이', 'Play Free Now')}</span>
              </a>
              <button
                type="button"
                data-testid="promo-hero-pack-btn"
                onClick={handleOpenPromoPrePack}
                disabled={cards.length === 0}
                className="inline-flex min-h-[52px] cursor-pointer items-center gap-2 rounded-full border-2 border-amber-300/80 bg-amber-950/85 px-6 py-3 text-sm font-extrabold text-amber-100 shadow-lg transition hover:bg-amber-900 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4 text-yellow-300" />
                <span>{tr('무료 1팩 미리 뽑기', 'Preview Free Pack')}</span>
              </button>
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            3. World Intro & Official Trailer (#intro)
        ===================================================================== */}
        <section
          id="intro"
          style={{ backgroundImage: `url(${SNS_LOCATIONS.BOX_TABLE})` }}
          className="relative bg-cover bg-center py-12 sm:py-16"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'linear-gradient(180deg, rgba(18, 10, 5, 0.92) 0%, rgba(28, 16, 8, 0.86) 50%, rgba(16, 9, 4, 0.94) 100%)',
            }}
          />
          <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-8 px-4 sm:px-6 lg:grid-cols-12">
            <div className="lg:col-span-5">
              <div className="text-xs font-extrabold uppercase tracking-[0.2em] text-amber-400">
                ELWIN SANCTUARY
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-amber-50 sm:text-3xl">
                {tr('엘윈마을 성소와 9대 종족의 전장', '9 Factions Clash in Elwin Sanctuary')}
              </h2>
              <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                {tr(
                  '물·불·바람·땅·인간·언데드·엘프·드워프·동물 9대 종족의 수호자와 382종 고유 카드로 나만의 덱을 완성하고, 풀보이스 원작 서사를 직접 돌파하세요.',
                  'Command champions from 9 elemental & fantasy factions with 382 original cards, and battle through a studio-voiced 40-episode fantasy saga.',
                )}
              </p>
              <div className="mt-5 grid grid-cols-2 gap-2.5 text-xs font-extrabold">
                <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                  <div className="text-base text-amber-300 sm:text-lg">
                    {tr('382장 고유 카드', '382 Cards')}
                  </div>
                  <div className="mt-0.5 text-amber-100/75">
                    {tr('9종족 225 + 중립 157', '9 Factions + 157 Neutral')}
                  </div>
                </div>
                <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                  <div className="text-base text-sky-300 sm:text-lg">
                    {tr('40부작 풀보이스', '40 Voiced EPs')}
                  </div>
                  <div className="mt-0.5 text-amber-100/75">
                    {tr('5컷 웹툰 스토리 극장', '5-Panel Webtoon Theater')}
                  </div>
                </div>
              </div>
            </div>

            <div className="lg:col-span-7">
              <div
                data-nosnippet
                className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black"
              >
                <div className="relative aspect-video w-full overflow-hidden bg-black">
                  {trailerFacadePlaying ? (
                    <iframe
                      key={`${lang}-${activeClip.youtubeId}`}
                      src={`https://www.youtube-nocookie.com/embed/${activeClip.youtubeId}?autoplay=1&rel=0&modestbranding=1&enablejsapi=1&origin=${encodeURIComponent(typeof window !== 'undefined' ? window.location.origin : 'https://snshero.com')}`}
                      title={`${tr('눈히어로 공식 웹툰', 'SNSHero Official Webtoon')} - ${activeClip.label}`}
                      allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                      referrerPolicy="strict-origin-when-cross-origin"
                      allowFullScreen
                      className="h-full w-full border-0"
                    />
                  ) : (
                    <button
                      type="button"
                      data-testid="promo-youtube-facade"
                      onClick={() => setTrailerFacadePlaying(true)}
                      className="group relative flex h-full w-full cursor-pointer flex-col items-center justify-center overflow-hidden bg-stone-950 text-center"
                    >
                      <img
                        src={
                          activeClip.id === 'ep1'
                            ? '/webtoon-assets/episode_01/scene_01.webp'
                            : activeClip.id === 'ep8'
                              ? '/hs-assets/screenshots/ingame_story_theater.png?v=20261116'
                              : '/webtoon-assets/episode_01/scene_14.webp'
                        }
                        alt=""
                        aria-hidden="true"
                        loading="lazy"
                        decoding="async"
                        className="absolute inset-0 h-full w-full object-cover opacity-75 transition duration-300 group-hover:scale-105 group-hover:opacity-90"
                      />
                      <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/80 via-black/30 to-black/40" />
                      <span className="relative z-10 flex h-14 w-14 items-center justify-center rounded-full border-2 border-amber-300 bg-amber-500/95 text-xl font-black text-stone-950 shadow-xl transition group-hover:scale-110">
                        ▶
                      </span>
                      <span className="relative z-10 mt-2.5 rounded-full border border-amber-300/60 bg-black/75 px-3.5 py-1 text-xs font-extrabold text-amber-100">
                        {tr(
                          `공식 웹툰 트레일러 재생 (${activeClip.label})`,
                          `Play Official Trailer (${activeClip.label})`,
                        )}
                      </span>
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/40 bg-[#1a0f07] px-3 py-2">
                  <a
                    href={youtubePlaylistUrl}
                    data-testid="promo-youtube-playlist-link"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-xs font-extrabold text-amber-300 underline decoration-amber-400/50 underline-offset-4 hover:text-amber-200"
                  >
                    {isKo ? 'YouTube 재생목록 ↗' : 'YouTube Playlist ↗'}
                  </a>
                  <div className="flex gap-1.5">
                    {trailerClips.map((clip, idx) => (
                      <button
                        key={clip.id}
                        type="button"
                        onClick={() => {
                          setActiveClipIdx(idx);
                          setTrailerFacadePlaying(false);
                        }}
                        className={`min-h-[34px] rounded-lg px-3 py-1 text-xs font-extrabold transition ${
                          idx === activeClipIdx
                            ? 'bg-amber-500 text-[#1b0f05]'
                            : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                        }`}
                      >
                        {clip.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            4. Core Systems: Kadan's Journey (#latest)
        ===================================================================== */}
        <section id="latest" className="hs-promo-parchment py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
                CORE SYSTEMS
              </div>
              <h2 className="promo-outline-dark mt-1 text-2xl font-black text-[#2b1707] sm:text-4xl">
                {tr('카단의 여정 핵심 시스템', "Core Systems of Kadan's Journey")}
              </h2>
            </div>

            <div className="mt-6 grid grid-cols-1 gap-2.5 sm:grid-cols-3">
              {featureTabs.map((tab) => {
                const active = tab.id === activeFeatureTab;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveFeatureTab(tab.id)}
                    className={`min-h-[52px] rounded-xl border-2 px-4 py-3 text-left transition ${
                      active
                        ? 'border-[#8b5a1b] bg-[#2a1709] text-amber-100 shadow-lg'
                        : 'border-[#c39b56] bg-[#fbf1da]/85 text-[#3c230d] hover:bg-[#fff8e8]'
                    }`}
                  >
                    <div
                      className={`text-[11px] font-extrabold ${
                        active ? 'text-amber-300' : 'text-[#8b5a1b]'
                      }`}
                    >
                      {tab.eyebrow}
                    </div>
                    <div className="mt-0.5 text-sm font-extrabold sm:text-base">{tab.title}</div>
                  </button>
                );
              })}
            </div>

            <div className="hs-promo-gold-frame mt-4 overflow-hidden rounded-2xl bg-[#241409] text-amber-50">
              <div className="grid grid-cols-1 items-center lg:grid-cols-12">
                <div className="relative h-56 overflow-hidden bg-black sm:h-72 lg:col-span-6 lg:h-full lg:min-h-[280px]">
                  <img
                    key={activeFeature.imageUrl}
                    src={activeFeature.imageUrl}
                    alt={activeFeature.title}
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover object-center"
                  />
                </div>
                <div className="p-5 sm:p-8 lg:col-span-6">
                  <div className="text-xs font-extrabold tracking-wider text-amber-400">
                    {activeFeature.eyebrow}
                  </div>
                  <h3 className="mt-1.5 text-xl font-black text-white sm:text-2xl">
                    {activeFeature.headline}
                  </h3>
                  <p className="mt-2.5 text-sm leading-relaxed text-amber-100/85">
                    {activeFeature.desc}
                  </p>
                  <div className="mt-5">
                    <a
                      href={activeFeature.ctaHref}
                      className="hs-promo-cta-purple inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                    >
                      <span>{activeFeature.ctaText}</span>
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            5. Key Features (#features)
        ===================================================================== */}
        <section id="features" className="hs-promo-cosmic py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-indigo-300">
                KEY FEATURES
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('게임 특징', 'Why Play SNSHero')}
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
              {[
                {
                  icon: <Flame className="h-6 w-6 text-amber-300" />,
                  title: tr('무설치 즉시 실행', 'Zero-Install Play'),
                  desc: tr(
                    '가입이나 설치 없이 웹에서 바로 실행되며 모든 카드와 전적이 자동 저장됩니다.',
                    'Play instantly in your browser with automatic local save—no sign-up needed.',
                  ),
                },
                {
                  icon: <Trophy className="h-6 w-6 text-sky-300" />,
                  title: tr('무료 382종 수집', '100% Free-to-Play'),
                  desc: tr(
                    '일일 의뢰·스토리·랭킹전·도박장 보상으로 382종 전 카드를 무료로 모을 수 있습니다.',
                    'Collect all 382 cards free via Daily Quests, Story Bosses, and Ranked Arena.',
                  ),
                },
                {
                  icon: <Swords className="h-6 w-6 text-emerald-300" />,
                  title: tr('카단의 기세 & 합동 필살기', "Kadan's Spirit & Dual Ultimate"),
                  desc: tr(
                    '스토리 자동플레이 중 연타(+1)·초록 정박(+10)으로 100을 채우고 불타오른 기세 버튼을 누르면 카단 눈보라 + 실리아 바람풍 연속 필살기가 작렬합니다.',
                    'In Story Auto-Play, charge to 100 via mash (+1) or green beat (+10), then tap the blazing orb to unleash Kadan Blizzard + Silia Windstorm!',
                  ),
                },
                {
                  icon: <Shield className="h-6 w-6 text-purple-300" />,
                  title: tr('모바일·PC 최적화', 'Mobile & Desktop Ready'),
                  desc: tr(
                    '스마트폰 한 손 조작, 전체화면 PWA, 데미지 비례 진동과 성우 음성을 지원합니다.',
                    'Optimized for one-handed mobile play, fullscreen PWA, haptics, and voice acting.',
                  ),
                },
              ].map((pillar) => (
                <div
                  key={pillar.title}
                  className="hs-promo-gold-frame flex flex-col rounded-2xl bg-[#181230]/90 p-5"
                >
                  <div className="mb-3 inline-flex h-11 w-11 items-center justify-center rounded-xl border border-amber-300/40 bg-black/40">
                    {pillar.icon}
                  </div>
                  <h3 className="text-base font-extrabold text-amber-200">{pillar.title}</h3>
                  <p className="mt-1.5 text-xs leading-relaxed text-indigo-100/85 sm:text-sm">
                    {pillar.desc}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            6. How to Play — Visible 6-Step Visual Guide (#how-to-play)
        ===================================================================== */}
        <section id="how-to-play" className="hs-promo-tavern py-12 sm:py-16">
          <div className="mx-auto max-w-4xl px-4 sm:px-6">
            <div className="mb-6 text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-emerald-300">
                HOW TO PLAY
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('게임 방법 (6단계 화면 가이드)', 'How to Play (6-Step Visual Guide)')}
              </h2>
            </div>

            <div className="hs-promo-gold-frame rounded-3xl bg-[#140c06]/95 p-4 sm:p-6">
              <HowToPlayCarousel variant="promo" playSound={false} />
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            7. 9 Factions & Legendary Heroes (#heroes — Directly Visible)
        ===================================================================== */}
        <section id="heroes" className="hs-promo-tavern py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
                9 FACTIONS &amp; HEROES
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('9대 종족 & 전설 영웅', '9 Factions & Legendary Heroes')}
              </h2>
            </div>

            <div className="mt-6 flex flex-wrap justify-center gap-2">
              {HERO_CLASS_ORDER.map((cls) => {
                const ui = getLocalizedHeroInfo(cls, lang);
                const isSelected = cls === selectedHeroClass;
                return (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => setSelectedHeroClass(cls)}
                    className={`flex min-h-[44px] cursor-pointer items-center gap-2 rounded-full border-2 px-3.5 py-1.5 text-xs font-extrabold transition sm:text-sm ${
                      isSelected
                        ? 'border-amber-300 bg-amber-500/25 text-white shadow-[0_0_16px_rgba(251,191,36,0.4)]'
                        : 'border-amber-600/40 bg-black/40 text-amber-200/80 hover:border-amber-400 hover:text-white'
                    }`}
                  >
                    <img
                      src={CLASS_CREST_URL[cls]}
                      alt=""
                      aria-hidden="true"
                      className="h-5 w-5 rounded-full object-cover"
                    />
                    <span>{ui.className}</span>
                  </button>
                );
              })}
            </div>

            <div
              style={{ background: selectedHero.frameGradient }}
              className="hs-promo-gold-frame mt-6 overflow-hidden rounded-3xl p-[2px]"
            >
              <div className="grid grid-cols-1 items-center gap-6 rounded-[21px] bg-[#140c07]/94 p-5 sm:p-7 lg:grid-cols-12">
                <div className="relative flex flex-col items-center justify-center lg:col-span-4">
                  <div
                    style={{ backgroundColor: selectedHero.accentColor }}
                    className="pointer-events-none absolute inset-6 rounded-full opacity-20 blur-3xl"
                  />
                  <img
                    src={resolveDialogueSpriteUrl(selectedHero.heroCutoutUrl)}
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="relative max-h-[280px] w-auto object-contain sm:max-h-[320px]"
                  />
                </div>

                <div className="lg:col-span-8">
                  <div className="flex flex-wrap items-center gap-2">
                    <img
                      src={CLASS_CREST_URL[selectedHero.heroClass]}
                      alt=""
                      aria-hidden="true"
                      className="h-7 w-7 rounded-full border border-amber-300/70"
                    />
                    <span className="rounded-full border border-amber-400/50 bg-black/45 px-3 py-0.5 text-xs font-extrabold text-amber-300">
                      {selectedHeroUi.className} · {selectedHeroUi.factionRealm}
                    </span>
                  </div>

                  <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                    {selectedHeroUi.name}
                    <span className="ml-2 text-sm font-bold text-amber-300 sm:text-base">
                      — {selectedHeroUi.title}
                    </span>
                  </h3>

                  <div className="mt-4 flex flex-col gap-3 rounded-2xl border border-amber-400/35 bg-black/45 p-3.5 sm:flex-row sm:items-center sm:justify-between">
                    <div className="text-sm font-bold text-white">
                      <span className="mr-2 text-xs font-extrabold text-sky-300">
                        {tr('영웅 능력 (2마나)', 'Hero Power (2 Mana)')}
                      </span>
                      <span className="font-extrabold">{selectedHeroUi.heroPowerName}</span>
                      <span className="ml-1.5 text-xs text-amber-200">
                        — {selectedHeroUi.heroPowerText}
                      </span>
                    </div>
                    <a
                      href={`/game.html?mode=ranked_battle&faction=${selectedHero.heroClass}`}
                      className="hs-promo-cta-purple inline-flex min-h-[44px] shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-extrabold"
                    >
                      <span>
                        {tr(`${selectedHeroUi.name} 플레이`, `Play ${selectedHeroUi.name}`)}
                      </span>
                      <ChevronRight className="h-3.5 w-3.5" />
                    </a>
                  </div>

                  <div className="mt-5">
                    <div className="mb-3 text-xs font-extrabold text-amber-300/90">
                      {tr(
                        `${selectedHeroUi.className} 대표 카드 (클릭 시 상세 보기)`,
                        `Signature ${selectedHeroUi.className} Cards (Click to inspect)`,
                      )}
                    </div>
                    <div className="flex flex-wrap items-center justify-center gap-4 pt-2 sm:justify-start sm:gap-5">
                      {heroSignatureCards.map((c) => (
                        <PromoCard key={c.id} card={c} onClick={setZoomedCard} size="md" />
                      ))}
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            8. 382-Card Official Library (#cards — Search & Filters Directly Visible)
        ===================================================================== */}
        <section id="cards" className="hs-promo-parchment py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="flex flex-col items-center justify-between gap-3 text-center md:flex-row md:text-left">
              <div>
                <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
                  CARD LIBRARY
                </div>
                <h2 className="promo-outline-dark mt-0.5 text-2xl font-black text-[#2b1707] sm:text-4xl">
                  {tr('382종 카드 도감', '382-Card Library')}
                </h2>
              </div>

              <div className="flex flex-wrap items-center justify-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAwakened3x((a) => !a)}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-extrabold shadow transition ${
                    showAwakened3x
                      ? 'border-emerald-300 bg-gradient-to-b from-emerald-500 to-emerald-800 text-white'
                      : 'border-[#8b5a1b] bg-[#2a1709] text-emerald-200 hover:bg-[#3e220e]'
                  }`}
                >
                  <span>🔥</span>
                  <span>{tr('3배 각성 보기', '3x Awakening')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setShowGolden((g) => !g)}
                  className={`inline-flex min-h-[44px] cursor-pointer items-center gap-1.5 rounded-full border-2 px-4 py-2 text-xs font-extrabold shadow transition ${
                    showGolden
                      ? 'border-yellow-300 bg-gradient-to-b from-amber-400 to-amber-700 text-white'
                      : 'border-[#8b5a1b] bg-[#2a1709] text-amber-200 hover:bg-[#3e220e]'
                  }`}
                >
                  <Crown className="h-4 w-4" />
                  <span>{tr('24K 황금 카드', '24K Golden Foil')}</span>
                </button>
              </div>
            </div>

            <div className="mt-5 rounded-2xl border-2 border-[#b88a44] bg-[#241409] p-3.5 text-amber-100 shadow-xl sm:p-4">
              <div className="flex flex-col gap-2.5 lg:flex-row lg:items-center lg:justify-between">
                <div className="relative max-w-md flex-1">
                  <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300/70" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => {
                      setSearchQuery(e.target.value);
                      setVisibleLimit(12);
                    }}
                    placeholder={tr(
                      '카드명 · 키워드 검색 (예: 카단, 도발)',
                      'Search card or keyword (e.g. Kadan, Taunt)',
                    )}
                    className="min-h-[42px] w-full rounded-xl border border-amber-500/40 bg-black/50 py-2 pl-9 pr-9 text-sm font-bold text-amber-50 placeholder-amber-200/45 focus:border-amber-300 focus:outline-none"
                  />
                  {searchQuery.length > 0 && (
                    <button
                      type="button"
                      data-testid="promo-card-search-clear"
                      onClick={() => {
                        setSearchQuery('');
                        setVisibleLimit(12);
                      }}
                      aria-label={tr('검색어 지우기', 'Clear search')}
                      className="absolute right-2.5 top-1/2 flex h-6 w-6 -translate-y-1/2 items-center justify-center rounded-full bg-amber-500/25 text-xs font-black text-amber-200 hover:bg-amber-500/50"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  )}
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  {(
                    [
                      { id: 'ALL', ko: '전체', en: 'All' },
                      { id: 'LEGENDARY', ko: '전설', en: 'Legendary' },
                      { id: 'EPIC', ko: '특급', en: 'Epic' },
                      { id: 'RARE', ko: '희귀', en: 'Rare' },
                      { id: 'COMMON', ko: '일반', en: 'Common' },
                      { id: 'FREE', ko: '기본', en: 'Basic' },
                    ] as const
                  ).map((r) => (
                    <button
                      key={r.id}
                      type="button"
                      onClick={() => {
                        setFilterRarity(r.id);
                        setVisibleLimit(12);
                      }}
                      className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                        filterRarity === r.id
                          ? 'bg-amber-500 text-[#1b0f05]'
                          : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                      }`}
                    >
                      {isKo ? r.ko : r.en}
                    </button>
                  ))}
                </div>
              </div>

              <div className="mt-2.5 flex flex-wrap gap-1.5 border-t border-amber-500/20 pt-2.5">
                <button
                  type="button"
                  onClick={() => {
                    setFilterClass('ALL');
                    setVisibleLimit(12);
                  }}
                  className={`min-h-[34px] rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                    filterClass === 'ALL'
                      ? 'bg-sky-500 text-white'
                      : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                  }`}
                >
                  {tr('전체 (382)', 'All (382)')}
                </button>
                {HERO_CLASS_ORDER.map((cls) => (
                  <button
                    key={cls}
                    type="button"
                    onClick={() => {
                      setFilterClass(cls);
                      setVisibleLimit(12);
                    }}
                    className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                      filterClass === cls
                        ? 'bg-sky-500 text-white'
                        : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                    }`}
                  >
                    <img src={CLASS_CREST_URL[cls]} alt="" className="h-4 w-4 rounded-full" />
                    <span>{getLocalizedHeroInfo(cls, lang).className}</span>
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setFilterClass('NEUTRAL');
                    setVisibleLimit(12);
                  }}
                  className={`inline-flex min-h-[34px] items-center gap-1.5 rounded-lg px-2.5 py-1 text-xs font-extrabold transition ${
                    filterClass === 'NEUTRAL'
                      ? 'bg-sky-500 text-white'
                      : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                  }`}
                >
                  <img src={CLASS_CREST_URL.NEUTRAL} alt="" className="h-4 w-4 rounded-full" />
                  <span>{tr('중립 (157)', 'Neutral (157)')}</span>
                </button>
              </div>

              <div className="mt-2 flex flex-wrap items-center gap-1.5 border-t border-amber-500/20 pt-2">
                <span className="mr-1 text-[11px] font-extrabold text-sky-300">
                  {tr('마나:', 'Mana:')}
                </span>
                <button
                  type="button"
                  data-testid="promo-mana-filter-ALL"
                  onClick={() => {
                    setFilterMana('ALL');
                    setVisibleLimit(12);
                  }}
                  className={`min-h-[30px] rounded-lg px-2.5 py-0.5 text-xs font-extrabold transition ${
                    filterMana === 'ALL'
                      ? 'bg-sky-500 text-white'
                      : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                  }`}
                >
                  {tr('전체', 'All')}
                </button>
                {[0, 1, 2, 3, 4, 5, 6, 7].map((m) => (
                  <button
                    key={m}
                    type="button"
                    data-testid={`promo-mana-filter-${m}`}
                    onClick={() => {
                      setFilterMana(m);
                      setVisibleLimit(12);
                    }}
                    className={`min-h-[30px] min-w-[30px] rounded-lg px-2 py-0.5 text-xs font-extrabold transition ${
                      filterMana === m
                        ? 'bg-sky-500 text-white'
                        : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                    }`}
                  >
                    {m === 7 ? '7+' : m}
                  </button>
                ))}
              </div>
            </div>

            {cardsLoading ? (
              <div className="py-12 text-center text-sm font-extrabold text-[#5c3a1a]">
                {tr('카드 데이터를 불러오는 중...', 'Loading cards...')}
              </div>
            ) : displayedCards.length === 0 ? (
              <div className="mt-6 rounded-2xl border-2 border-dashed border-[#a67c3b] bg-[#fbf1da]/70 py-10 text-center">
                <p className="text-sm font-extrabold text-[#3c230d]">
                  {tr('조건에 맞는 카드가 없습니다.', 'No matching cards found.')}
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setFilterClass('ALL');
                    setFilterRarity('ALL');
                    setFilterMana('ALL');
                    setSearchQuery('');
                  }}
                  className="hs-promo-cta-teal mt-3 min-h-[40px] rounded-full px-5 py-2 text-xs font-extrabold"
                >
                  {tr('필터 초기화', 'Reset Filters')}
                </button>
              </div>
            ) : (
              <>
                <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-10 pt-3 sm:gap-x-8 sm:gap-y-12">
                  {displayedCards.map((c) => (
                    <PromoCard
                      key={c.id}
                      card={c}
                      isGolden={showGolden}
                      journeyMultiplier={
                        showAwakened3x && (c.type === 'MINION' || c.type === 'WEAPON') ? 3 : 1
                      }
                      onClick={setZoomedCard}
                      size="md"
                    />
                  ))}
                </div>

                <div className="mt-8 flex flex-col items-center gap-2.5">
                  <div className="text-xs font-extrabold text-[#5c3a1a]">
                    {tr(
                      `${displayedCards.length} / ${filteredCards.length}장 표시`,
                      `${displayedCards.length} / ${filteredCards.length} cards`,
                    )}
                  </div>
                  {visibleLimit < filteredCards.length && (
                    <button
                      type="button"
                      onClick={() => setVisibleLimit((n) => n + 12)}
                      className="hs-promo-cta-teal min-h-[44px] rounded-full px-7 py-2.5 text-sm font-extrabold"
                    >
                      {tr('카드 더 보기 (+12장)', 'Load More (+12)')}
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            9. 3 Signature Game Modes (#modes — Concise 3-Column Grid)
        ===================================================================== */}
        <section id="modes" className="hs-promo-tavern py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
                GAME MODES
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('3대 핵심 게임 모드', '3 Core Game Modes')}
              </h2>
            </div>

            <div className="mt-8 grid grid-cols-1 gap-5 md:grid-cols-3">
              {[
                {
                  id: 'story',
                  badge: tr('풀보이스 · 3장=3배 각성', 'Voiced · 3x Awakening'),
                  title: tr('스토리모드 (40화 성우 풀보이스)', 'Story Mode · 40화 스토리모드'),
                  desc: tr(
                    '5컷 웹툰 극장과 함께 40명의 원작 보스를 격파하세요. 5화마다 보스 팩이 지급됩니다.',
                    'Clear 40 voiced story bosses with 3x Awakened cards and earn Boss Packs every 5 episodes.',
                  ),
                  img: '/hs-assets/screenshots/ingame_story_theater.png?v=20261116',
                  href: '/game?mode=story&ep=1&theater=on',
                  cta: tr('스토리 출격', 'Play Story'),
                },
                {
                  id: 'ranked',
                  badge: tr('공정 1배 룰 · 공식 전적', 'Fair 1x · Official Ladder'),
                  title: tr('온라인형 랭킹대전 (Ranked Arena)', 'Ranked Arena · 실시간 랭크 아레나'),
                  desc: tr(
                    '실시간 도전자와 정통 1배 룰로 겨루며, 오직 랭킹전 결과만 공식 승률·순위에 기록됩니다.',
                    'Compete under fair 1x rules against live-style challengers to climb the Official Ladder.',
                  ),
                  img: isKo
                    ? '/hs-assets/screenshots/ingame_ranked_battle_ko.png?v=20261116'
                    : '/hs-assets/screenshots/ingame_ranked_battle.png?v=20261116',
                  href: '/game?mode=ranked',
                  cta: tr('랭킹전 입장', 'Enter Ranked'),
                },
                {
                  id: 'bogart',
                  badge: tr('1~1,000G 베팅 · 100% 랜덤덱', '1–1,000G Bet · Random Deck'),
                  title: tr('보가트의 도박장 (Bogart\'s Hall)', "Bogart's Hall · 보가트의 도박장"),
                  desc: tr(
                    '카드 보유량과 무관하게 매 판 30장 랜덤덱으로 승부하고 승리 시 판돈 2배 골드를 획득합니다.',
                    'Wager 1–1,000G with 100% Random 30-Card Decks and win 2x Gold on victory.',
                  ),
                  img: isKo
                    ? '/hs-assets/screenshots/ingame_bogart_slider_ko.webp'
                    : '/hs-assets/screenshots/ingame_bogart_slider_en.webp',
                  href: '/game?mode=bogart',
                  cta: tr('도박장 입장', "Enter Bogart's Hall"),
                },
              ].map((m) => (
                <div
                  key={m.id}
                  className="hs-promo-gold-frame flex flex-col justify-between overflow-hidden rounded-2xl bg-[#180f08]"
                >
                  <div>
                    <div className="aspect-video w-full overflow-hidden bg-black">
                      <img
                        src={m.img}
                        alt={m.title}
                        loading="lazy"
                        decoding="async"
                        className="h-full w-full object-cover"
                      />
                    </div>
                    <div className="p-5">
                      <div className="text-[11px] font-extrabold text-amber-300">{m.badge}</div>
                      <h3 className="mt-1 text-lg font-black text-white sm:text-xl">{m.title}</h3>
                      <p className="mt-2 text-xs leading-relaxed text-amber-100/85 sm:text-sm">
                        {m.desc}
                      </p>
                    </div>
                  </div>
                  <div className="px-5 pb-5">
                    <a
                      href={m.href}
                      className="hs-promo-cta-purple inline-flex min-h-[44px] w-full items-center justify-center gap-1.5 rounded-full px-5 py-2 text-xs font-extrabold sm:text-sm"
                    >
                      <span>{m.cta}</span>
                      <ChevronRight className="h-4 w-4" />
                    </a>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            10. Gold Prestige Cosmetics (#gold-economy — Clean 4-Card Showcase)
        ===================================================================== */}
        <section
          id="gold-economy"
          data-testid="promo-gold-economy-section"
          className="bg-gradient-to-b from-[#0b1636] to-[#120b05] py-12 sm:py-16"
        >
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-yellow-300">
                GOLD TREASURE & SKIN EXCHANGE
              </div>
              <h2 className="promo-outline mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('황금 주화 보물 교환소', 'Gold Treasure & Skin Exchange')}
              </h2>
              <p className="mx-auto mt-2 max-w-xl text-xs font-bold text-sky-100/85 sm:text-sm">
                {tr(
                  '플레이로 모은 골드로 미보유 24K 전설 영웅 상자·각성 팩·마력 가루를 교환하고 프리미엄 카드 뒷면을 소장하세요.',
                  'Spend earned Gold on guaranteed 24K Legendary Chests, Awakening Packs & Dust, plus Premium Card Backs.',
                )}
              </p>
            </div>

            <div className="mt-7 grid grid-cols-2 gap-3.5 lg:grid-cols-4">
              {[
                {
                  id: 'chest',
                  title: tr('24K 전설 영웅 상자', '24K Legendary Chest'),
                  price: '1,000G',
                  where: tr('미보유 전설 100% 확정', '100% Unowned Legendary'),
                  img: '/hs-assets/prestige/shop_chest_legendary.webp',
                },
                {
                  id: 'chest_awakening',
                  cat: 'chest',
                  title: tr('3배 각성 5팩 보급함', '3x Awakening 5-Pack'),
                  price: '450G',
                  where: tr('카드팩 5개 + 100 가루', '5 Packs + 100 Dust'),
                  img: '/hs-assets/prestige/shop_chest_awakening.webp',
                },
                {
                  id: 'cardback',
                  title: tr('프리미엄 카드 뒷면', 'Premium Card Backs'),
                  price: isKo ? '1,400원~ / 500G~' : '$0.99~ / 500G~',
                  where: tr('실버·24K골드·성소·VIP 용옥새', 'Silver · 24K Gold · Sanctuary · VIP'),
                  img: '/hs-assets/prestige/shop_chest_royal_vault.webp',
                },
                {
                  id: 'set',
                  title: tr('24K 순금 황제 세트', '24K Royal Sovereign Set'),
                  price: '600G~',
                  where: tr('24K 테두리 + 왕관 + 칭호', '24K Frame + Crown + Title'),
                  img: '/hs-assets/prestige/shop_set_royal_24k.webp',
                },
              ].map((item) => (
                <a
                  key={item.id}
                  href={`/game?tab=shop&category=${'cat' in item && item.cat ? item.cat : item.id}`}
                  className="overflow-hidden rounded-2xl border border-amber-300/45 bg-stone-950/90 transition hover:-translate-y-1 hover:border-yellow-300"
                >
                  <div className="relative h-28 w-full overflow-hidden bg-black sm:h-32">
                    <img
                      src={item.img}
                      alt=""
                      aria-hidden="true"
                      loading="lazy"
                      decoding="async"
                      className="h-full w-full object-cover"
                    />
                    <span className="absolute right-2 top-2 rounded-full border border-yellow-300/60 bg-black/80 px-2 py-0.5 text-[10px] font-extrabold text-yellow-300">
                      {item.price}
                    </span>
                  </div>
                  <div className="p-3">
                    <h3 className="text-sm font-black text-white">{item.title}</h3>
                    <p className="mt-0.5 text-[11px] font-semibold text-amber-100/80">
                      {item.where}
                    </p>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            11. Free 3-Pack Start Banner (#packs)
        ===================================================================== */}
        <section
          id="packs"
          style={{ backgroundImage: `url(${SNS_LOCATIONS.PACK_ALTAR})` }}
          className="relative overflow-hidden bg-cover bg-center py-14 sm:py-20"
        >
          <div
            className="pointer-events-none absolute inset-0"
            style={{
              background:
                'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.2) 0%, rgba(16, 9, 4, 0.86) 68%, rgba(8, 5, 2, 0.96) 100%)',
            }}
          />
          <div className="relative z-10 mx-auto flex max-w-4xl flex-col items-center px-4 text-center sm:px-6">
            <div className="mb-5 flex items-center justify-center gap-4 sm:gap-6">
              <img
                src={SNS_CARD_BACK_THEMES.silver.imageUrl}
                alt={tr(SNS_CARD_BACK_THEMES.silver.name, 'Silver Guardian Card Back')}
                className="hidden h-32 w-auto -rotate-12 rounded-xl shadow-2xl sm:block"
              />
              <div className="h-40 w-28 sm:h-44 sm:w-32">
                <SnsBoosterPackArt glowing />
              </div>
              <img
                src={SNS_CARD_BACK_THEMES.bronze.imageUrl}
                alt={tr(SNS_CARD_BACK_THEMES.bronze.name, 'Elwin Bronze Card Back')}
                className="hidden h-32 w-auto rotate-12 rounded-xl shadow-2xl sm:block"
              />
            </div>

            <h2 className="promo-outline text-2xl font-black text-white sm:text-4xl">
              {tr('지금 접속하고 무료 3팩을 개봉하세요!', 'Claim Your 3 Free Packs Today!')}
            </h2>
            <a
              href={appendAttributionToGameUrl('/game?open=pack3')}
              onClick={() => trackHeroEvent('hero_promo_cta_click', { cta_id: 'bottom_enter_village', lang })}
              className="hs-promo-cta-purple mt-6 inline-flex min-h-[52px] items-center gap-2 rounded-full px-9 py-3.5 text-base font-extrabold tracking-wide sm:text-lg"
            >
              <Gamepad2 className="h-5 w-5" />
              <span>{tr('엘윈마을 입장하기', 'Enter Elwin Village')}</span>
            </a>
          </div>
        </section>

        <div className="hs-promo-divider" />

        {/* =====================================================================
            12. Official Novel, Webtoon & Channels (#universe — All Visible)
        ===================================================================== */}
        <section id="universe" className="bg-[#0b101d] py-12 sm:py-16">
          <div className="mx-auto max-w-6xl px-4 sm:px-6">
            <div className="text-center">
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-400">
                SNSHERO UNIVERSE
              </div>
              <h2 className="mt-1 text-2xl font-black text-white sm:text-4xl">
                {tr('공식 웹소설 · 웹툰 · 채널', 'Official Novel, Webtoon & Channels')}
              </h2>
            </div>

            <div className="mt-7 grid grid-cols-1 gap-4 sm:grid-cols-3">
              <a
                href="/book.html"
                className="group overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12192c] transition hover:-translate-y-1 hover:border-amber-400/70"
              >
                <div className="aspect-[16/9] overflow-hidden bg-black">
                  <img
                    src="/webtoon-assets/episode_01/scene_04.webp"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                    <BookOpen className="h-4 w-4 text-amber-300" />
                    <span>{tr('공식 웹소설 (1~40화)', 'Official 40-EP Web Novel')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300/80">
                    {tr('전 회차 무료 열람', 'Read all 40 chapters free')}
                  </p>
                </div>
              </a>

              <a
                href="/webtoon.html"
                className="group overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12192c] transition hover:-translate-y-1 hover:border-amber-400/70"
              >
                <div className="aspect-[16/9] overflow-hidden bg-black">
                  <img
                    src="/webtoon-assets/episode_01/scene_14.webp"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                    <Layers className="h-4 w-4 text-sky-300" />
                    <span>{tr('공식 풀컬러 웹툰', 'Official Full-Color Webtoon')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300/80">
                    {tr('카단과 이그니스의 연대기', 'Illustrated fantasy series')}
                  </p>
                </div>
              </a>

              <button
                type="button"
                onClick={() => setMediaTheaterOpen(true)}
                className="group cursor-pointer overflow-hidden rounded-2xl border border-amber-400/50 bg-[#12192c] text-left transition hover:-translate-y-1 hover:border-yellow-300"
              >
                <div className="aspect-[16/9] overflow-hidden bg-black">
                  <img
                    src="/webtoon-assets/episode_01/scene_01.webp"
                    alt=""
                    aria-hidden="true"
                    loading="lazy"
                    decoding="async"
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-amber-200">
                    <Sparkles className="h-4 w-4 text-yellow-300" />
                    <span>{tr('제1화 풀보이스 미리보기', 'EP.1 Voiced Preview')}</span>
                  </div>
                  <p className="mt-1 text-xs text-slate-300/80">
                    {tr('5컷 웹툰 + 성우 내레이션 감상', '5 panels + studio voice sample')}
                  </p>
                </div>
              </button>
            </div>

            <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-xs font-extrabold">
              <a
                href="https://novel.naver.com/challenge/list?novelId=1250635"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center rounded-full border border-slate-700 bg-[#12192c] px-4 py-1.5 text-amber-100 transition hover:border-amber-300"
              >
                {tr('네이버 웹소설 ↗', 'Naver Novel ↗')}
              </a>
              <a
                href="https://comic.naver.com/challenge/list?titleId=857363"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center rounded-full border border-slate-700 bg-[#12192c] px-4 py-1.5 text-amber-100 transition hover:border-amber-300"
              >
                {tr('네이버 도전만화 ↗', 'Naver Webtoon ↗')}
              </a>
              <a
                href="https://nlink.munpia.com/link/munpia/novel/616551"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center rounded-full border border-slate-700 bg-[#12192c] px-4 py-1.5 text-amber-100 transition hover:border-amber-300"
              >
                {tr('문피아 ↗', 'Munpia ↗')}
              </a>
              <a
                href={youtubePlaylistUrl}
                data-testid="promo-youtube-channel-link"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center rounded-full border border-slate-700 bg-[#12192c] px-4 py-1.5 text-amber-100 transition hover:border-amber-300"
              >
                {isKo ? 'YouTube (@snshero) ↗' : 'YouTube EN (@snshero) ↗'}
              </a>
              <a
                href="https://github.com/Dayyoung/snshero"
                target="_blank"
                rel="noopener noreferrer"
                className="min-h-[38px] inline-flex items-center rounded-full border border-slate-700 bg-[#12192c] px-4 py-1.5 text-amber-100 transition hover:border-amber-300"
              >
                {tr('GitHub 오픈소스 ↗', 'GitHub ↗')}
              </a>
            </div>
          </div>
        </section>

        {/* =====================================================================
            Global Footer
        ===================================================================== */}
        <footer className="border-t border-amber-900/50 bg-[#151210] px-4 py-10 text-center text-xs text-stone-400">
          <div className="mx-auto max-w-4xl">
            <img
              src={getSnsLogoUrl(lang)}
              alt=""
              aria-hidden="true"
              className="mx-auto h-9 w-auto opacity-90"
            />
            <div className="mt-4 flex flex-wrap justify-center gap-4 font-bold text-stone-300">
              <a href="/game" className="hover:text-amber-300">
                {tr('게임 시작', 'Play Game')}
              </a>
              <a href="/game?mode=story&ep=1&theater=on" className="hover:text-amber-300">
                {tr('스토리모드', 'Story Mode')}
              </a>
              <a href="/game?mode=ranked" className="hover:text-amber-300">
                {tr('랭킹대전', 'Ranked Arena')}
              </a>
              <a href="/game?mode=bogart" className="hover:text-amber-300">
                {tr('보가트 도박장', "Bogart's Hall")}
              </a>
              <a href="/wiki/tip" className="hover:text-amber-300">
                {tr('공략집', 'Guide')}
              </a>
              <a href="/book.html" className="hover:text-amber-300">
                {tr('웹소설', 'Novel')}
              </a>
              <a href="/webtoon.html" className="hover:text-amber-300">
                {tr('웹툰', 'Webtoon')}
              </a>
            </div>

            <div
              data-testid="footer-language-switcher"
              className="mt-4 flex items-center justify-center"
            >
              <div className="flex flex-wrap items-center justify-center gap-1.5 rounded-2xl border border-amber-400/30 bg-black/35 p-1.5">
                {HERO_LANGUAGES.map((item) => {
                  const active = lang === item.code;
                  return (
                    <button
                      key={item.code}
                      type="button"
                      data-testid={`footer-lang-${item.code}`}
                      onClick={() => setLang(item.code)}
                      className={`inline-flex min-h-[38px] cursor-pointer items-center gap-1 rounded-full px-2.5 py-1 text-[11px] font-extrabold transition ${
                        active
                          ? 'bg-amber-400 text-[#1b120b] shadow-sm'
                          : 'text-amber-200/80 hover:bg-white/10 hover:text-amber-100'
                      }`}
                    >
                      <span aria-hidden="true">{item.flag}</span>
                      <span>{item.nativeName}</span>
                    </button>
                  );
                })}
              </div>
            </div>

            <p
              id="kr-official-directory"
              className="mx-auto mt-4 max-w-3xl text-[11px] leading-relaxed text-stone-400"
            >
              눈히어로 · 엘윈마을의 영웅들 · 카단의 여정 (SNSHero.com) — 9대 종족 382종 무설치 정통 전략 웹 TCG · 첫 방문 무료 3팩+250G+160가루 · 40화 성우 풀보이스 스토리 모드(3장=3배 각성) · 보가트의 도박장(1~1,000G 랜덤 30장 덱) · 실시간 랭크 아레나
            </p>
            <p className="mt-2 text-[11px] text-stone-500">
              © 2026 SNSHero (SNSHero.com) · Heroes of Elwin Village &amp; Kadan&apos;s Journey.
            </p>
          </div>
        </footer>

        {/* =====================================================================
            Card Detail Lightbox Modal
        ===================================================================== */}
        {zoomedCard && (
          <div
            onClick={() => setZoomedCard(null)}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="hs-promo-gold-frame relative grid w-full max-w-2xl grid-cols-1 gap-6 rounded-3xl bg-[#1b1109] p-6 text-amber-50 sm:grid-cols-12 sm:p-8"
            >
              <button
                type="button"
                onClick={() => setZoomedCard(null)}
                aria-label={tr('닫기', 'Close')}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/50 bg-black/50 text-amber-200 hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>

              <div className="flex items-center justify-center pt-5 sm:col-span-5">
                <PromoCard
                  card={zoomedCard}
                  isGolden={showGolden}
                  journeyMultiplier={
                    showAwakened3x && (zoomedCard.type === 'MINION' || zoomedCard.type === 'WEAPON')
                      ? 3
                      : 1
                  }
                  size="lg"
                />
              </div>

              <div className="flex flex-col justify-between sm:col-span-7">
                <div>
                  <div className="flex items-center gap-2">
                    <img
                      src={CLASS_CREST_URL[zoomedCard.cardClass] || CLASS_CREST_URL.NEUTRAL}
                      alt=""
                      className="h-6 w-6 rounded-full"
                    />
                    <span className="text-xs font-extrabold text-amber-300">
                      {getZoomedCardClassLabel(zoomedCard)}
                      {' · '}
                      {getPromoRarityLabel(zoomedCard.rarity, isKo)}
                      {zoomedCard.race ? ` · ${getPromoRaceLabel(zoomedCard.race, isKo)}` : ''}
                    </span>
                  </div>

                  <h3 className="mt-2 text-2xl font-black text-white">
                    {getCardName(zoomedCard, lang)}
                  </h3>

                  {(getCardCharName(zoomedCard, lang) || getCardFactionLabel(zoomedCard, lang)) && (
                    <div className="mt-1 text-xs font-bold text-amber-300/80">
                      {[getCardCharName(zoomedCard, lang), getCardFactionLabel(zoomedCard, lang)]
                        .filter(Boolean)
                        .join(' · ')}
                    </div>
                  )}

                  <div className="mt-3 rounded-xl border border-amber-500/30 bg-black/40 p-3 text-sm leading-relaxed text-amber-100">
                    <div
                      dangerouslySetInnerHTML={{
                        __html:
                          formatCardHtmlText(getCardText(zoomedCard, lang)) ||
                          (zoomedCard.type === 'WEAPON'
                            ? tr(
                                `영웅 장착 무기 (공격력 ${zoomedCard.attack ?? 0} / 내구도 ${getCardBaseDurability(zoomedCard)})`,
                                `Hero Weapon (Attack ${zoomedCard.attack ?? 0} / Durability ${getCardBaseDurability(zoomedCard)})`,
                              )
                            : tr(
                                '강력한 기본 전투력을 갖춘 영웅 하수인입니다.',
                                'A steadfast hero minion ready to command the battlefield.',
                              )),
                      }}
                    />
                  </div>

                  {getCardFlavor(zoomedCard, lang) && (
                    <p className="mt-3 text-xs italic leading-relaxed text-amber-200/75">
                      “{getCardFlavor(zoomedCard, lang)}”
                    </p>
                  )}

                  {CRAFTING_COST[zoomedCard.rarity] && (
                    <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                      <div className="rounded-lg border border-sky-400/30 bg-sky-950/40 px-3 py-2">
                        {tr('제작', 'Craft')}:{' '}
                        <strong className="text-sky-300">
                          {CRAFTING_COST[zoomedCard.rarity]} {tr('가루', 'Dust')}
                        </strong>
                      </div>
                      <div className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2">
                        {tr('추출', 'Disenchant')}:{' '}
                        <strong className="text-amber-300">
                          {DISENCHANT_VALUE[zoomedCard.rarity]} {tr('가루', 'Dust')}
                        </strong>
                      </div>
                    </div>
                  )}
                </div>

                <div className="mt-5 flex flex-col gap-2.5">
                  <button
                    type="button"
                    data-testid="promo-card-rhythm-test-btn"
                    onClick={() => {
                      const cls =
                        zoomedCard.cardClass === 'NEUTRAL' || zoomedCard.cardClass === 'DREAM'
                          ? 'PRIEST'
                          : zoomedCard.cardClass;
                      playFactionChord(cls as any, false);
                      playRhythmCue('awakening_3x_trill', { muted: false });
                      setRhythmPreviewMsg(
                        tr(
                          '🎵 1.5x·2.0x 오카리나 정박 공명 완료!',
                          '🎵 1.5x·2.0x Ocarina Beat Resonance Triggered!',
                        ),
                      );
                      window.setTimeout(() => setRhythmPreviewMsg(null), 2200);
                    }}
                    className="inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full border border-emerald-400/50 bg-emerald-950/75 px-4 py-2.5 text-sm font-extrabold text-emerald-100 transition hover:bg-emerald-900/80"
                  >
                    <span>
                      {rhythmPreviewMsg ||
                        tr('🎵 1.5x·2.0x 리듬 공명 시험', '🎵 Test 1.5x·2.0x Rhythm Resonance')}
                    </span>
                  </button>
                  <a
                    data-testid="promo-card-deck-focus-cta"
                    href={appendAttributionToGameUrl(
                      `/game?deck_focus=${encodeURIComponent(zoomedCard.id)}&rhythm=on`,
                    )}
                    className="hs-promo-cta-purple inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-full px-5 py-2.5 text-sm font-extrabold"
                  >
                    <span>
                      {tr(
                        '⚔️ 이 카드 주력 덱으로 즉시 출격 →',
                        '⚔️ Launch With This Card Deck →',
                      )}
                    </span>
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* =====================================================================
            Pre-Game Free Pack #1 Modal
        ===================================================================== */}
        {promoPackModalOpen && promoPackCards && (
          <div
            onClick={() => setPromoPackModalOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="hs-promo-gold-frame relative w-full max-w-4xl rounded-3xl bg-[#1a0f08] p-5 text-center text-amber-50 sm:p-8"
            >
              <button
                type="button"
                onClick={() => setPromoPackModalOpen(false)}
                aria-label={tr('닫기', 'Close')}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/50 bg-black/50 text-amber-200 hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                {tr('🎉 무료 1호 카드팩 5장 미리보기', '🎉 Free Pack #1 Preview')}
              </h3>
              <p className="mx-auto mt-1.5 max-w-xl text-xs font-bold text-amber-200/90 sm:text-sm">
                {tr(
                  '게임에 입장하면 이 5장을 그대로 수령하고 남은 무료 2팩 + 250골드를 바로 받을 수 있습니다.',
                  'Enter the game to keep these 5 cards plus 2 more Free Packs and 250 Gold.',
                )}
              </p>
              <div className="my-6 flex flex-wrap items-center justify-center gap-4 pt-2">
                {promoPackCards.map((item, idx) => (
                  <PromoCard
                    key={`${item.card.id}_${idx}`}
                    card={item.card}
                    isGolden={item.isGolden}
                    size="sm"
                    onClick={setZoomedCard}
                  />
                ))}
              </div>
              <a
                href={appendAttributionToGameUrl('/game?claim_promo=1')}
                onClick={() => trackHeroEvent('hero_promo_cta_click', { cta_id: 'claim_promo_pack', lang })}
                className="hs-promo-cta-purple inline-flex min-h-[48px] items-center gap-2 rounded-full px-8 py-3 text-sm font-extrabold sm:text-base"
              >
                <span>{tr('5장 수령 & 게임 시작하기 →', 'Claim Cards & Start Playing →')}</span>
              </a>
            </div>
          </div>
        )}

        {/* =====================================================================
            Ep.1 Voiced Webtoon Mini Theater Modal
        ===================================================================== */}
        {mediaTheaterOpen && (
          <div
            onClick={() => setMediaTheaterOpen(false)}
            className="fixed inset-0 z-50 flex items-center justify-center overflow-y-auto bg-black/85 p-4 backdrop-blur-sm"
          >
            <div
              onClick={(e) => e.stopPropagation()}
              className="hs-promo-gold-frame relative w-full max-w-3xl rounded-3xl bg-[#150d07] p-5 text-amber-50 sm:p-7"
            >
              <button
                type="button"
                onClick={() => setMediaTheaterOpen(false)}
                aria-label={tr('닫기', 'Close')}
                className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-amber-400/50 bg-black/50 text-amber-200 hover:bg-black"
              >
                <X className="h-4 w-4" />
              </button>
              <h3 className="text-xl font-black text-white sm:text-2xl">
                {tr('제1화 · 성우 풀보이스 & 웹툰 미리보기', 'EP.1 · Voiced Webtoon Preview')}
              </h3>
              <div className="mt-3 rounded-xl border border-amber-500/35 bg-black/50 p-3">
                <audio
                  controls
                  preload="none"
                  src="/hs-assets/snshero-audio/story/ep01_cut1.mp3"
                  className="w-full"
                />
              </div>
              <div className="mt-4 grid grid-cols-2 gap-2.5 sm:grid-cols-5">
                {[0, 1, 2, 3, 4].map((idx) => (
                  <div
                    key={idx}
                    className="overflow-hidden rounded-xl border border-amber-500/30 bg-black"
                  >
                    <img
                      src={`/webtoon-assets/episode_01/scene_0${idx}.webp`}
                      alt={`EP1 Panel ${idx + 1}`}
                      className="aspect-[3/4] w-full object-cover"
                    />
                  </div>
                ))}
              </div>
              <div className="mt-5 flex flex-wrap items-center justify-between gap-3">
                <a
                  href={appendAttributionToGameUrl('/game?mode=story&ep=1')}
                  onClick={() => trackHeroEvent('hero_promo_cta_click', { cta_id: 'theater_ep1_play', lang })}
                  className="hs-promo-cta-purple inline-flex min-h-[44px] items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                >
                  <span>{tr('제1화 전장 입장 →', 'Play Ep.1 Now →')}</span>
                </a>
                <div className="flex gap-3 text-xs font-bold text-amber-200/80">
                  <a href="/book.html?ep=1" className="underline hover:text-amber-100">
                    {tr('웹소설 보기', 'Read Novel')}
                  </a>
                  <a href="/webtoon.html?ep=1" className="underline hover:text-amber-100">
                    {tr('웹툰 보기', 'Read Webtoon')}
                  </a>
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Bottom-Right Kadan Chatbot */}
        <KadanChatbotWidget
          screen="BOX_HUB"
          profile={promoProfile}
          selectedMode="RANKED"
          autoPlay={promoAutoRunning}
          battleSnapshot={null}
          onEnableAutoPlay={() => {
            setPromoAutoRunning(true);
            window.setTimeout(() => {
              window.location.href = '/game?mode=story_battle&autoplay=1';
            }, 550);
          }}
          onDisableAutoPlay={() => setPromoAutoRunning(false)}
          onNavigateScreen={(target, modeOverride) => {
            if (target === 'PACK_OPENING') {
              window.location.href = '/game?mode=pack';
            } else if (target === 'COLLECTION') {
              window.location.href = '/game?mode=collection';
            } else if (target === 'HERO_SELECT') {
              window.location.href =
                modeOverride === 'PRACTICE_NORMAL' ? '/game?mode=ai' : '/game?mode=ranked';
            } else {
              window.location.href = '/game';
            }
          }}
          onStartJourney={() => {
            window.location.href = '/game?mode=story&ep=1&theater=on';
          }}
          onOpenShop={() => {
            window.location.href = '/game?mode=pack';
          }}
          onOpenQuestLog={() => {
            window.location.href = '/game';
          }}
        />
      </div>
    </SharedAdSenseShell>
  );
};
