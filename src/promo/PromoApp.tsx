import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Crown,
  Flame,
  Gamepad2,
  Globe,
  Layers,
  Menu,
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
  SNS_LOGO_URL,
  SnsBoosterPackArt,
  SnsSnowCompassSeal,
} from '../hearthstone/components/SnsHeroArtKit';
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
import { tr, useHeroLanguage } from '../i18n/heroLang';
import { PromoCard, getPromoRaceLabel, getPromoRarityLabel } from './PromoCard';

type FeatureTabId = 'story' | 'awake' | 'pack';

const YOUTUBE_PLAYLIST_URL = 'https://www.youtube.com/@snshero/playlists';

export const PromoApp: React.FC = () => {
  const { lang, setLang } = useHeroLanguage();
  const isKo = lang === 'ko';

  const [cards, setCards] = useState<ClassicCardDef[]>([]);
  const [cardsLoading, setCardsLoading] = useState(true);
  const [selectedHeroClass, setSelectedHeroClass] = useState<HeroClass>('PRIEST');
  const [activeFeatureTab, setActiveFeatureTab] = useState<FeatureTabId>('story');
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  // Trailer controls
  const [activeClipIdx, setActiveClipIdx] = useState(0);

  // Card Library Filters
  const [filterClass, setFilterClass] = useState<string>('ALL');
  const [filterRarity, setFilterRarity] = useState<string>('LEGENDARY');
  const [searchQuery, setSearchQuery] = useState('');
  const [showGolden, setShowGolden] = useState(false);
  const [visibleLimit, setVisibleLimit] = useState(12);
  const [zoomedCard, setZoomedCard] = useState<ClassicCardDef | null>(null);

  useEffect(() => {
    document.documentElement.lang = isKo ? 'ko' : 'en';
    document.title = isKo
      ? '눈히어로 — 엘윈마을 전략 카드 배틀 | 공식 소개 페이지'
      : 'SNSHero — Elwin Village Strategic Card Battle | Official Showcase';
  }, [isKo]);

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
    bullets: string[];
    imageUrl: string;
    ctaText: string;
    ctaHref: string;
  }[] = useMemo(
    () => [
      {
        id: 'story',
        title: tr('40화 웹툰 극장 & 보스 레이드', '40-EP Webtoon Theater & Boss Raids'),
        eyebrow: tr('카단의 여정 · 풀보이스 스토리모드', "Kadan's Journey · Full-Voice Story Mode"),
        headline: tr(
          '원작 40부작 서사를 전장에서 직접 돌파하세요!',
          'Fight through all 40 episodes of the original saga!',
        ),
        desc: tr(
          '매 에피소드마다 5컷 기승전결 웹툰과 스튜디오 남성 성우 내레이션 200트랙이 상영됩니다. 야심가 루시안, 데스나이트 아르투스, 대심판관 말라카이 등 40화 적장들과 직접 결투하고 보스 팩을 획득하세요.',
          'Every episode opens with a 5-panel voiced webtoon theater featuring 200 narration tracks. Challenge iconic villains including Grand Chancellor Lucian, Arch-Inquisitor Malakai, and Death Knight Artus to earn boss packs.',
        ),
        bullets: [
          tr(
            '매 5화 돌파 시 눈히어로 카드 팩 +1개 보너스',
            'Earn +1 bonus SNSHero Card Pack every 5 episodes cleared',
          ),
          tr(
            '40화 완주 시 +300G & 3팩 지급 + 무한 환생 모드 개방',
            'Clear Episode 40 for +300 Gold, 3 Packs, and Infinite Reincarnation Mode',
          ),
          tr(
            '스마트 자동플레이 기본 탑재로 누구나 부담 없이 감상·전투',
            'Built-in Smart Auto-Play lets anyone enjoy both theater and battles effortlessly',
          ),
        ],
        imageUrl: '/hs-assets/screenshots/ingame_story_theater.png',
        ctaText: tr('스토리모드 바로 출정', 'Enter Story Mode'),
        ctaHref: '/game.html?mode=story',
      },
      {
        id: 'awake',
        title: tr("여정 전용 '3장 = 3배' 각성 법칙", "Journey-Exclusive '3 Copies = 3x Power' Awakening"),
        eyebrow: tr('중복 카드가 곧 압도적 전력으로', 'Duplicate Cards Multiply Your Combat Power'),
        headline: tr(
          '카드를 3장 모으면 공격력과 생명력이 3배로 폭발합니다!',
          'Collect 3+ copies of a card to unleash 3x Attack & Health!',
        ),
        desc: tr(
          '스토리모드(카단의 여정)에서는 동일 하수인·무기를 3장 이상(전설은 2장 이상) 보유할 경우 보유 장수 배율(×3, ×4, ×N배)로 능력치가 증폭됩니다. 패배해도 골드 보급팩 개봉으로 즉시 덱이 강해집니다.',
          "In Kadan's Journey Story Mode, holding 3+ copies of a minion or weapon (2+ for Legendaries) multiplies its Attack and Health by your copy count (x3, x4, xN). Open Gold packs anytime to break through tough bosses.",
        ),
        bullets: [
          tr(
            '랭킹대전·AI대전은 정통 1배 룰로 공정한 실력 대결 보장',
            'Ranked & AI Battles preserve classic 1x competitive balance',
          ),
          tr(
            '스토리모드 전용 중복 각성으로 40화·환생 고난이도 돌파',
            'Story-only Awakening scaling powers your climb through all 40 episodes & Reincarnations',
          ),
          tr(
            '여분 분해 시 여정 3배 배수 영향을 사전에 명확히 안내',
            'Clear Crafting safeguards warn you before disenchanting Journey multiplier copies',
          ),
        ],
        imageUrl: '/hs-assets/screenshots/ingame_collection_awake.png',
        ctaText: tr('내 덱 강화하러 가기', 'Upgrade Your Deck'),
        ctaHref: '/game.html',
      },
      {
        id: 'pack',
        title: tr('382종 고유 아트 & 황금 천장 엔진', '382 Original Artworks & Pity Engine'),
        eyebrow: tr('9대 종족 × 25장 + 중립 157장', '9 Factions × 25 Cards + 157 Neutral'),
        headline: tr(
          '첫 10팩 내 첫 전설 확정, 전 등급 중복 방지 보급!',
          'Guaranteed Legendary within your first 10 packs + duplicate protection!',
        ),
        desc: tr(
          '9개 종족의 대표 영웅과 충원 영웅 225장, 그리고 판타지 중립 카드 157장까지 총 382종 전수 고유 일러스트가 수록되어 있습니다. 팩 개봉 시 여관주인의 호명 대사와 24K 황금 포일 카드를 만나보세요.',
          'Collect 382 hand-crafted cards across 9 elemental & fantasy factions plus 157 Neutrals. Crack open glowing packs with Innkeeper callouts and pull shimmering 24K Golden foils.',
        ),
        bullets: [
          tr('신규 방문 즉시 무료 카드 팩 3팩 즉시 지급', '3 Free Card Packs granted immediately on first visit'),
          tr(
            '첫 10팩 이내 전설 100% 확정 · 40팩 전설 천장 · 중복 방지',
            'First Legendary guaranteed in 10 packs · 40-pack Legendary pity · duplicate protection',
          ),
          tr(
            '불필요한 카드는 신비한 가루로 추출해 원하는 전설 직접 제작',
            'Disenchant extras into Arcane Dust to craft any Legendary you desire',
          ),
        ],
        imageUrl: '/hs-assets/screenshots/ingame_pack_altar.png',
        ctaText: tr('무료 3팩 개봉하기', 'Open 3 Free Packs'),
        ctaHref: '/game.html',
      },
    ],
    [lang],
  );

  const storyBossHighlights = useMemo(
    () => [
      {
        name: tr('심연화신 루시안', 'Abyssal Avatar Lucian'),
        role: tr('붉은 유리 궁정 재상 · 최종 흑막', 'Chancellor of Crimson Glass · Mastermind'),
        img: '/hs-assets/bosses/boss_abyss_lucian.webp',
      },
      {
        name: tr('대심판관 말라카이', 'Arch-Inquisitor Malakai'),
        role: tr('광휘 신전 이단심문관', 'Grand Inquisitor of the Radiant Temple'),
        img: '/hs-assets/bosses/boss_malakai.webp',
      },
      {
        name: tr('환각마녀 모르가나', 'Mirage Witch Morgana'),
        role: tr('안개 늪의 환술 지배자', 'Sovereign of Illusion in Misty Fen'),
        img: '/hs-assets/bosses/boss_morgana.webp',
      },
      {
        name: tr('수문장 발타자르', 'Gatekeeper Balthazar'),
        role: tr('심연 관문의 강철 수호자', 'Iron Warden of the Abyssal Gate'),
        img: '/hs-assets/bosses/boss_balthazar.webp',
      },
    ],
    [lang],
  );

  const trailerClips = useMemo(
    () => [
      {
        id: 'ep1',
        label: tr('제1화 · 눈보라 아래 두 서약', 'EP.1 · Two Oaths Beneath the Blizzard'),
        youtubeId: 'KOf8IAic2QY',
        embedUrl: 'https://www.youtube.com/embed/KOf8IAic2QY?list=PLVch67W9z4TA&rel=0&modestbranding=1',
      },
      {
        id: 'ep8',
        label: tr('제8화 · 붉은 갈기의 기수', 'EP.8 · Rider of the Crimson Mane'),
        youtubeId: 'BIHe4MrtCIw',
        embedUrl: 'https://www.youtube.com/embed/BIHe4MrtCIw?list=PLVch67W9z4TA&rel=0&modestbranding=1',
      },
      {
        id: 'ep15',
        label: tr('제15화 · 독사와 사자의 밤', 'EP.15 · Night of Viper and Lion'),
        youtubeId: 'LHHngbtkJwg',
        embedUrl: 'https://www.youtube.com/embed/LHHngbtkJwg?list=PLVch67W9z4TA&rel=0&modestbranding=1',
      },
    ],
    [lang],
  );

  const embers = useMemo(
    () =>
      Array.from({ length: 18 }).map((_, i) => ({
        id: i,
        left: `${6 + ((i * 39) % 88)}%`,
        size: 3 + (i % 3) * 1.5,
        delay: `${(i * 0.42).toFixed(2)}s`,
        duration: `${(5.5 + (i % 4) * 1.2).toFixed(2)}s`,
        dx: `${(i % 2 === 0 ? 1 : -1) * (12 + (i % 4) * 8)}px`,
      })),
    [],
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
    return cards
      .filter((c) => {
        if (filterClass !== 'ALL' && c.cardClass !== filterClass) return false;
        if (filterRarity !== 'ALL' && c.rarity !== filterRarity) return false;
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
      .sort(compareCardsStoneOrder);
  }, [cards, filterClass, filterRarity, searchQuery]);

  const displayedCards = useMemo(
    () => filteredCards.slice(0, visibleLimit),
    [filteredCards, visibleLimit],
  );

  const activeFeature = featureTabs.find((item) => item.id === activeFeatureTab) || featureTabs[0];
  const activeClip = trailerClips[activeClipIdx] || trailerClips[0];

  const getZoomedCardClassLabel = (card: ClassicCardDef) => {
    if (card.cardClass !== 'NEUTRAL' && card.cardClass !== 'DREAM') {
      if (isKo) return CLASSIC_HEROES[card.cardClass as HeroClass].classNameKo;
      return CARD_CLASS_LABELS_EN[card.cardClass] || card.cardClass;
    }
    return isKo ? '중립 카드' : 'Neutral';
  };

  return (
    <div className="min-h-screen w-full bg-[#120b06] text-[#f8ebd2]">
      {/* =====================================================================
          1. Sticky Tavern Wood Top Navigation (GNB)
      ===================================================================== */}
      <header className="hs-promo-nav sticky top-0 z-50 w-full">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[70px] sm:px-6">
          {/* Brand Logo */}
          <a href="#hero" className="flex items-center gap-2.5 group">
            <img
              src="/icon.png"
              alt={tr('눈히어로', 'SNSHero')}
              className="h-9 w-9 rounded-lg border border-amber-300/60 shadow transition-transform group-hover:scale-105"
            />
            <img
              src={SNS_LOGO_URL}
              alt={tr('눈히어로 엘윈마을 카드 배틀', 'SNSHero Elwin Village Card Battle')}
              className="h-8 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:h-9"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-6 text-sm font-extrabold tracking-wide text-amber-100/90 lg:flex">
            <a href="#intro" className="transition hover:text-amber-300">{tr('게임 정보', 'Overview')}</a>
            <a href="#latest" className="transition hover:text-amber-300">{tr('신규 콘텐츠', 'Features')}</a>
            <a href="#heroes" className="transition hover:text-amber-300">{tr('9대 영웅', '9 Heroes')}</a>
            <a href="#cards" className="transition hover:text-amber-300">{tr('카드 라이브러리', 'Card Library')}</a>
            <a href="#modes" className="transition hover:text-amber-300">{tr('게임 모드', 'Game Modes')}</a>
            <a href="#universe" className="transition hover:text-amber-300">{tr('미디어 믹스', 'Universe')}</a>
          </nav>

          {/* Right CTA & Mobile Menu Toggle */}
          <div className="flex items-center gap-2.5">
            <a
              href="/book.html"
              className="hidden items-center gap-1 rounded-full border border-amber-300/40 bg-black/30 px-3.5 py-1.5 text-xs font-extrabold text-amber-200 transition hover:border-amber-300 hover:bg-amber-950/60 sm:inline-flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>{tr('공식 소설', 'Novel')}</span>
            </a>
            <a
              href="/webtoon.html"
              className="hidden items-center gap-1 rounded-full border border-sky-300/40 bg-black/30 px-3.5 py-1.5 text-xs font-extrabold text-sky-200 transition hover:border-sky-300 hover:bg-sky-950/60 md:inline-flex"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>{tr('공식 웹툰', 'Webtoon')}</span>
            </a>
            <a
              href="/game.html"
              className="hs-promo-cta-purple inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold tracking-wide sm:px-6 sm:py-2.5 sm:text-sm"
            >
              <span>{tr('지금 플레이', 'Play Now')}</span>
              <ChevronRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label={tr('메뉴 열기', 'Toggle Menu')}
              className="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-black/40 text-amber-200 lg:hidden"
            >
              {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
            </button>
          </div>
        </div>

        {/* Mobile Drawer Menu */}
        {mobileMenuOpen && (
          <div className="border-t border-amber-500/30 bg-[#1a0f08]/98 px-4 py-4 lg:hidden">
            <div className="grid grid-cols-2 gap-2 text-sm font-extrabold text-amber-100">
              {[
                { href: '#intro', label: tr('게임 정보', 'Overview') },
                { href: '#latest', label: tr('신규 콘텐츠', 'Features') },
                { href: '#heroes', label: tr('9대 영웅', '9 Heroes') },
                { href: '#cards', label: tr('카드 라이브러리', 'Card Library') },
                { href: '#modes', label: tr('게임 모드', 'Game Modes') },
                { href: '#universe', label: tr('미디어 믹스', 'Universe') },
                { href: '/book.html', label: tr('웹소설 40부작', 'Novel 40 EP') },
                { href: '/webtoon.html', label: tr('공식 웹툰', 'Webtoon') },
                { href: '/stone.html', label: tr('오리지널 스톤', 'Classic Stone') },
                { href: '/', label: tr('게임 바로 시작', 'Play Now') },
              ].map((item) => (
                <a
                  key={item.href}
                  href={item.href}
                  onClick={() => setMobileMenuOpen(false)}
                  className="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400"
                >
                  {item.label}
                </a>
              ))}
            </div>
          </div>
        )}
      </header>

      {/* =====================================================================
          2. Full-Bleed Hero Banner
      ===================================================================== */}
      <section
        id="hero"
        style={{ backgroundImage: `url(${SNS_LOCATIONS.TAVERN_EXTERIOR})` }}
        className="relative flex min-h-[580px] w-full items-center justify-center overflow-hidden bg-cover bg-center px-4 py-16 sm:min-h-[680px] sm:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 44%, rgba(251, 191, 36, 0.2) 0%, rgba(20, 11, 5, 0.72) 55%, rgba(10, 6, 3, 0.96) 100%)',
          }}
        />

        <div className="pointer-events-none absolute inset-0 overflow-hidden">
          {embers.map((em) => (
            <span
              key={em.id}
              style={
                {
                  left: em.left,
                  bottom: '-14px',
                  width: `${em.size}px`,
                  height: `${em.size}px`,
                  animation: `promoEmberRise ${em.duration} ease-in ${em.delay} infinite`,
                  '--dx': em.dx,
                } as React.CSSProperties
              }
              className="absolute rounded-full bg-amber-300 shadow-[0_0_10px_3px_rgba(251,146,60,0.85)]"
            />
          ))}
        </div>

        <img
          src={CLASSIC_HEROES.PRIEST.heroCutoutUrl}
          alt={getLocalizedHeroInfo('PRIEST', lang).name}
          className="pointer-events-none absolute -bottom-4 -left-10 h-[250px] w-auto object-contain opacity-30 drop-shadow-[0_18px_36px_rgba(0,0,0,0.95)] sm:-left-6 sm:h-[340px] sm:opacity-55 lg:left-[-2%] lg:h-[470px] lg:opacity-95 xl:left-[2%] xl:h-[540px]"
        />
        <img
          src={CLASSIC_HEROES.WARRIOR.heroCutoutUrl}
          alt={getLocalizedHeroInfo('WARRIOR', lang).name}
          className="pointer-events-none absolute -bottom-4 -right-12 h-[250px] w-auto object-contain opacity-30 drop-shadow-[0_18px_36px_rgba(0,0,0,0.95)] sm:-right-6 sm:h-[340px] sm:opacity-55 lg:right-[-2%] lg:h-[470px] lg:opacity-95 xl:right-[2%] xl:h-[540px]"
        />

        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-[#140b05]/85 px-4 py-1.5 text-xs font-extrabold tracking-[0.16em] text-amber-200 shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>ELWIN VILLAGE • 382 CARDS • 9 FACTIONS</span>
          </div>

          <div className="relative mb-3 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-amber-400/20 blur-2xl" />
            <img
              src={SNS_LOGO_URL}
              alt={tr('눈히어로', 'SNSHero')}
              className="relative w-[270px] max-w-[82vw] drop-shadow-[0_16px_32px_rgba(0,0,0,0.95)] sm:w-[420px]"
            />
          </div>

          <div className="mb-4 flex items-center gap-3">
            <SnsSnowCompassSeal size={36} />
            <span className="promo-outline text-sm font-extrabold tracking-[0.22em] text-amber-200 sm:text-base">
              {tr('엘윈마을의 영웅들 · 카단과 이그니스의 여정', "Heroes of Elwin Village · Kadan & Ignis's Journey")}
            </span>
            <SnsSnowCompassSeal size={36} />
          </div>

          <h1 className="promo-outline break-keep text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            {tr('놀랄 만큼 쉽고', 'Deceptively Simple')}
            <br />
            {tr('믿기 힘들 만큼 재미있습니다', 'Insanely Fun')}
          </h1>

          <p className="promo-outline mt-4 max-w-2xl text-sm font-bold leading-relaxed text-amber-100/90 sm:text-lg">
            {tr(
              '전략 카드 게임 • 무료 웹 플레이 • 첫 방문 3카드팩 즉시 지급',
              'Strategic Card Battle • Free Web Play • 3 Bonus Packs on First Visit',
            )}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/game.html"
              className="hs-promo-cta-purple inline-flex min-h-[52px] items-center gap-2.5 rounded-full px-9 py-3.5 text-base font-extrabold tracking-wide sm:text-lg"
            >
              <Gamepad2 className="h-5 w-5" />
              <span>{tr('지금 플레이', 'Play Now')}</span>
            </a>
            <a
              href="/game.html?mode=story"
              className="hs-promo-cta-teal-dark inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 py-3.5 text-sm font-extrabold sm:text-base"
            >
              <Swords className="h-4 w-4" />
              <span>{tr('카단의 여정 1화 체험', "Play Kadan's Journey")}</span>
            </a>
          </div>

          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-amber-200/80">
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">
              {tr('PC · Mac 브라우저', 'PC · Mac Browser')}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">
              {tr('iOS · Android PWA 전체화면', 'iOS · Android PWA Fullscreen')}
            </span>
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">
              {tr('100% 로컬스토리지 영구 저장', '100% LocalStorage Save')}
            </span>
          </div>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          3. Intro Section
      ===================================================================== */}
      <section
        id="intro"
        style={{ backgroundImage: `url(${SNS_LOCATIONS.BOX_TABLE})` }}
        className="relative bg-cover bg-center py-16 sm:py-24"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'linear-gradient(180deg, rgba(18, 10, 5, 0.92) 0%, rgba(28, 16, 8, 0.84) 50%, rgba(16, 9, 4, 0.94) 100%)',
          }}
        />
        <div className="relative z-10 mx-auto grid max-w-6xl grid-cols-1 items-center gap-10 px-4 sm:px-6 lg:grid-cols-12">
          <div className="lg:col-span-5">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-400">
              WELCOME TO ELWIN SANCTUARY
            </div>
            <h2 className="promo-outline text-3xl font-black text-amber-50 sm:text-4xl">
              {tr('엘윈마을 성소에 어서 오세요!', 'Welcome to Elwin Sanctuary!')}
            </h2>
            <p className="mt-4 text-base leading-relaxed text-amber-100/85">
              {tr(
                '검은 집어넣고 덱을 뽑으세요. ',
                'Sheathe your sword and draw your deck — it is time for ',
              )}
              <strong className="text-amber-300">{tr('눈히어로', 'SNSHero')}</strong>
              {tr(
                '의 시간입니다! 전설적인 전략이 부딪히는 전투에서 비전 주문을 시전하고, 382종의 고유 하수인을 소환하며, 물·불·바람·땅·인간·언데드·엘프·드워프·동물 9대 종족의 수호자들을 지휘하세요.',
                '! Cast arcane spells, summon 382 original minions, and command the champions of Water, Fire, Wind, Earth, Human, Undead, Elf, Dwarf, and Beast.',
              )}
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-extrabold">
              <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                <div className="text-lg text-amber-300">{tr('382장', '382 Cards')}</div>
                <div className="mt-0.5 text-amber-100/80">
                  {tr('9종족 225 + 중립 157', '9 Factions (225) + 157 Neutral')}
                </div>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                <div className="text-lg text-sky-300">{tr('40부작', '40 Episodes')}</div>
                <div className="mt-0.5 text-amber-100/80">
                  {tr('풀보이스 5컷 웹툰 극장', '5-Panel Story Theater')}
                </div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/game.html"
                className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold"
              >
                <span>{tr('성소 입장하기', 'Enter Sanctuary')}</span>
                <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="#heroes"
                className="hs-promo-cta-teal-dark inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold"
              >
                <span>{tr('9대 종족 영웅 보기', 'Explore 9 Heroes')}</span>
              </a>
            </div>
          </div>

          <div className="lg:col-span-7">
            <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                <iframe
                  key={activeClip.youtubeId}
                  src={activeClip.embedUrl}
                  title={`${tr('눈히어로 공식 웹툰', 'SNSHero Official Webtoon')} - ${activeClip.label}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/40 bg-[#1a0f07] px-3 py-2.5">
                <a
                  href={YOUTUBE_PLAYLIST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-extrabold text-amber-300 underline decoration-amber-400/50 underline-offset-4 hover:text-amber-200"
                >
                  {tr('유튜브 공식 웹툰 재생목록 ↗', 'Official YouTube Playlist ↗')}
                </a>
                <div className="flex flex-wrap gap-1.5">
                  {trailerClips.map((clip, idx) => (
                    <button
                      key={clip.id}
                      type="button"
                      onClick={() => setActiveClipIdx(idx)}
                      className={`rounded-lg px-2.5 py-1 text-[11px] font-extrabold transition ${
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
          4. Latest Content / Story Showcase
      ===================================================================== */}
      <section id="latest" className="hs-promo-parchment py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
              {tr('최신 연대기 · 핵심 시스템', 'CHRONICLES & CORE SYSTEMS')}
            </div>
            <h2 className="promo-outline-dark mt-1.5 text-3xl font-black text-[#2b1707] sm:text-5xl">
              {tr('신규 콘텐츠: 카단의 여정', "Featured Saga: Kadan's Journey")}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-[#5c3a1a] sm:text-base">
              {tr(
                '오직 눈히어로(game.html)에서만 만날 수 있는 40부작 서사 보스전, 3장=3배 각성, 382종 고유 카드 시스템을 확인하세요.',
                'Discover 40 boss encounters, the 3-Copies = 3x Awakening rule, and 382 original cards exclusive to SNSHero.',
              )}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {featureTabs.map((tab) => {
              const active = tab.id === activeFeatureTab;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => setActiveFeatureTab(tab.id)}
                  className={`rounded-xl border-2 px-4 py-3.5 text-left transition ${
                    active
                      ? 'border-[#8b5a1b] bg-[#2a1709] text-amber-100 shadow-lg'
                      : 'border-[#c39b56] bg-[#fbf1da]/80 text-[#3c230d] hover:bg-[#fff8e8]'
                  }`}
                >
                  <div className={`text-[11px] font-extrabold ${active ? 'text-amber-300' : 'text-[#8b5a1b]'}`}>
                    {tab.eyebrow}
                  </div>
                  <div className="mt-1 text-sm font-extrabold sm:text-base">{tab.title}</div>
                </button>
              );
            })}
          </div>

          <div className="hs-promo-gold-frame mt-5 overflow-hidden rounded-2xl bg-[#241409] text-amber-50">
            <div className="grid grid-cols-1 items-center lg:grid-cols-12">
              <div className="relative h-64 overflow-hidden bg-black sm:h-80 lg:col-span-6 lg:h-full lg:min-h-[360px]">
                <img
                  src={activeFeature.imageUrl}
                  alt={activeFeature.title}
                  className="h-full w-full object-cover object-center transition-transform duration-500 hover:scale-105"
                />
                <div
                  className="pointer-events-none absolute inset-0"
                  style={{
                    background:
                      'linear-gradient(90deg, rgba(0,0,0,0.08) 0%, rgba(36,20,9,0.85) 100%)',
                  }}
                />
              </div>
              <div className="p-6 sm:p-9 lg:col-span-6">
                <div className="text-xs font-extrabold tracking-wider text-amber-400">
                  {activeFeature.eyebrow}
                </div>
                <h3 className="mt-2 text-2xl font-black text-white sm:text-3xl">
                  {activeFeature.headline}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  {activeFeature.desc}
                </p>
                <ul className="mt-4 space-y-2 text-xs font-bold text-amber-200/90 sm:text-sm">
                  {activeFeature.bullets.map((b) => (
                    <li key={b} className="flex items-start gap-2">
                      <span className="mt-1 h-2 w-2 shrink-0 rounded-full bg-amber-400" />
                      <span>{b}</span>
                    </li>
                  ))}
                </ul>
                <div className="mt-7 flex flex-wrap gap-3">
                  <a
                    href={activeFeature.ctaHref}
                    className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold"
                  >
                    <span>{activeFeature.ctaText}</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                  <a
                    href="#cards"
                    className="hs-promo-cta-teal-dark inline-flex items-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold"
                  >
                    <span>{tr('382종 카드 보기', 'Browse 382 Cards')}</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-[#2b1707] sm:text-2xl">
                {tr('카단의 여정 주요 적장 & 레이드 보스', 'Major Story Rivals & Raid Bosses')}
              </h3>
              <a
                href="/game.html?mode=story"
                className="hs-promo-cta-teal rounded-full px-4 py-1.5 text-xs font-extrabold"
              >
                {tr('전체 도전하기', 'Challenge All')}
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {storyBossHighlights.map((boss) => (
                <a
                  key={boss.img}
                  href="/game.html?mode=story"
                  className="hs-promo-gold-frame group overflow-hidden rounded-xl bg-[#1d1008] transition hover:-translate-y-1.5"
                >
                  <div className="aspect-[4/3] overflow-hidden bg-black">
                    <img
                      src={boss.img}
                      alt={boss.name}
                      className="h-full w-full object-cover object-top transition duration-300 group-hover:scale-108"
                    />
                  </div>
                  <div className="p-3">
                    <div className="text-sm font-extrabold text-amber-200">{boss.name}</div>
                    <div className="mt-0.5 text-[11px] font-bold text-amber-100/70">{boss.role}</div>
                  </div>
                </a>
              ))}
            </div>
          </div>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          5. Gameplay Pillars
      ===================================================================== */}
      <section id="features" className="hs-promo-cosmic py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-indigo-300">
              CORE PILLARS
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              {tr('게임 특징', 'Why Play SNSHero')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-indigo-100/80 sm:text-base">
              {tr(
                '눈히어로는 랭킹대전 전설을 노리는 전략가든, 가볍게 카단의 여정을 즐기는 팬이든 누구나 원하는 방식으로 플레이할 수 있습니다.',
                "Whether you're climbing the Ranked ladder or exploring Kadan's 40-episode saga, play your way right in the browser.",
              )}
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Flame className="h-7 w-7 text-amber-300" />,
                title: tr('부담없는 무설치 재미', 'Zero-Install Browser Play'),
                desc: tr(
                  '회원가입이나 다운로드 없이 브라우저에서 즉시 실행! 모든 카드와 전적이 로컬스토리지에 안전하게 영구 보존됩니다.',
                  'Launch instantly with no downloads or sign-ups. Your entire collection and progress save safely in LocalStorage.',
                ),
              },
              {
                icon: <Trophy className="h-7 w-7 text-sky-300" />,
                title: tr('무료로 플레이하고 승리하세요', 'Free-to-Play Mastery'),
                desc: tr(
                  '일일 의뢰·랭킹전·AI대전·스토리모드로 골드와 카드 팩을 획득하고 382종 고유 카드를 무료로 수집하세요.',
                  'Earn Gold and Card Packs through Daily Quests, Ranked Play, AI Battles, and Story Mode to collect all 382 cards free.',
                ),
              },
              {
                icon: <Swords className="h-7 w-7 text-emerald-300" />,
                title: tr('바로 시작하기 & 스마트 AI', 'Easy to Learn & Smart AI'),
                desc: tr(
                  '직관적인 마나 수정 룰과 모드별 자동플레이 지원! 초보자도 입문 가이드를 따라 1분 만에 박진감 넘치는 결투를 즐깁니다.',
                  'Classic mana-crystal combat with built-in Episode 0 interactive tutorial and smart Auto-Play support.',
                ),
              },
              {
                icon: <Shield className="h-7 w-7 text-purple-300" />,
                title: tr('플랫폼 간 완벽한 최적화', 'Crafted for Every Screen'),
                desc: tr(
                  '데스크톱, 태블릿, 스마트폰 세로/가로 전체화면 PWA 지원과 데미지 비례 타격 진동·성우 풀보이스를 제공합니다.',
                  'Responsive desktop & mobile PWA fullscreen layouts with tactile impact haptics and sound.',
                ),
              },
            ].map((pillar) => (
              <div
                key={pillar.title}
                className="hs-promo-gold-frame flex flex-col rounded-2xl bg-[#181230]/90 p-6 transition hover:-translate-y-1.5 hover:bg-[#221942]"
              >
                <div className="mb-4 inline-flex h-13 w-13 items-center justify-center rounded-xl border border-amber-300/40 bg-black/40 shadow-inner">
                  {pillar.icon}
                </div>
                <h3 className="text-lg font-extrabold text-amber-200">{pillar.title}</h3>
                <p className="mt-2.5 text-sm leading-relaxed text-indigo-100/80">{pillar.desc}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          6. 9 Factions & Heroes Interactive Showcase
      ===================================================================== */}
      <section id="heroes" className="hs-promo-tavern py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
              9 FACTIONS & HEROES
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              {tr('9대 종족 & 전설 영웅', '9 Factions & Legendary Heroes')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-amber-100/80 sm:text-base">
              {tr(
                '각 종족을 이끄는 대표 영웅을 선택해 고유 영웅 능력과 대표 카드를 확인해 보세요.',
                'Select a faction champion to inspect their unique Hero Power and signature class cards.',
              )}
            </p>
          </div>

          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            {HERO_CLASS_ORDER.map((cls) => {
              const ui = getLocalizedHeroInfo(cls, lang);
              const isSelected = cls === selectedHeroClass;
              return (
                <button
                  key={cls}
                  type="button"
                  onClick={() => setSelectedHeroClass(cls)}
                  className={`flex items-center gap-2 rounded-full border-2 px-3.5 py-2 text-xs font-extrabold transition sm:text-sm ${
                    isSelected
                      ? 'scale-105 border-amber-300 bg-amber-500/25 text-white shadow-[0_0_20px_rgba(251,191,36,0.45)]'
                      : 'border-amber-600/40 bg-black/40 text-amber-200/80 hover:border-amber-400 hover:text-white'
                  }`}
                >
                  <img
                    src={CLASS_CREST_URL[cls]}
                    alt={ui.className}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span>{ui.className}</span>
                  <span className="hidden text-[11px] opacity-80 sm:inline">({ui.name})</span>
                </button>
              );
            })}
          </div>

          <div
            style={{ background: selectedHero.frameGradient }}
            className="hs-promo-gold-frame mt-8 overflow-hidden rounded-3xl p-[2px]"
          >
            <div className="grid grid-cols-1 items-center gap-6 rounded-[21px] bg-[#140c07]/92 p-5 sm:p-8 lg:grid-cols-12">
              <div className="relative flex flex-col items-center justify-center lg:col-span-4">
                <div
                  style={{ backgroundColor: selectedHero.accentColor }}
                  className="pointer-events-none absolute inset-6 rounded-full opacity-20 blur-3xl"
                />
                <img
                  src={selectedHero.heroCutoutUrl}
                  alt={selectedHeroUi.name}
                  className="relative max-h-[340px] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)]"
                />
              </div>

              <div className="lg:col-span-8">
                <div className="flex flex-wrap items-center gap-2.5">
                  <img
                    src={CLASS_CREST_URL[selectedHero.heroClass]}
                    alt={selectedHeroUi.className}
                    className="h-8 w-8 rounded-full border border-amber-300/70"
                  />
                  <span className="rounded-full border border-amber-400/50 bg-black/45 px-3 py-0.5 text-xs font-extrabold text-amber-300">
                    {selectedHeroUi.className} · {tr('거점', 'Realm')}: {selectedHeroUi.factionRealm}
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-black text-white sm:text-4xl">
                  {selectedHeroUi.name}
                  <span className="ml-2.5 block text-base font-bold text-amber-300 sm:inline sm:text-lg">
                    — {selectedHeroUi.title}
                  </span>
                </h3>

                <blockquote className="mt-3 border-l-4 border-amber-400/70 pl-3.5 text-sm font-bold italic text-amber-100/90">
                  “{selectedHeroUi.emotes.start}”
                </blockquote>

                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/35 bg-black/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                      {tr('고유 영웅 능력 (2 마나)', 'Hero Power (2 Mana)')}
                    </div>
                    <div className="mt-0.5 text-base font-extrabold text-white">
                      {selectedHeroUi.heroPowerName}
                      <span className="ml-2 text-sm font-bold text-amber-200">
                        — {selectedHeroUi.heroPowerText}
                      </span>
                    </div>
                  </div>
                  <a
                    href="/game.html?mode=ranked"
                    className="hs-promo-cta-purple inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-extrabold"
                  >
                    <span>{tr(`${selectedHeroUi.name} 덱 플레이`, `Play ${selectedHeroUi.name}`)}</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>

                <div className="mt-6">
                  <div className="mb-4 text-xs font-extrabold uppercase tracking-wider text-amber-300/90">
                    {tr(
                      `${selectedHeroUi.className} 대표 카드 (클릭하여 상세 보기)`,
                      `Signature ${selectedHeroUi.className} Cards (Click to inspect)`,
                    )}
                  </div>
                  <div className="flex flex-wrap items-center justify-center gap-5 pt-4 sm:justify-start sm:gap-6">
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
          7. 382-Card Official Library Showcase
      ===================================================================== */}
      <section id="cards" className="hs-promo-parchment py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
                OFFICIAL CARD LIBRARY
              </div>
              <h2 className="promo-outline-dark mt-1 text-3xl font-black text-[#2b1707] sm:text-4xl">
                {tr('눈히어로 382종 카드 도감', '382-Card Official Library')}
              </h2>
              <p className="mt-1.5 text-sm font-bold text-[#5c3a1a]">
                {tr(
                  'game.html에 수록된 실제 382장 카드(9종족 × 25장 + 중립 157장)를 미리 살펴보고 황금 포일까지 확인하세요.',
                  'Preview all 382 playable cards (9 factions × 25 + 157 Neutral) including 24K Golden foils.',
                )}
              </p>
            </div>

            <button
              type="button"
              onClick={() => setShowGolden((g) => !g)}
              className={`inline-flex items-center gap-2 rounded-full border-2 px-5 py-2.5 text-xs font-extrabold shadow transition ${
                showGolden
                  ? 'border-yellow-300 bg-gradient-to-b from-amber-400 to-amber-700 text-white'
                  : 'border-[#8b5a1b] bg-[#2a1709] text-amber-200 hover:bg-[#3e220e]'
              }`}
            >
              <Crown className="h-4 w-4" />
              <span>
                {showGolden
                  ? tr('24K 황금 카드 미리보기 ON', '24K Golden Foil Preview ON')
                  : tr('24K 황금 카드 미리보기', 'Preview 24K Golden Foil')}
              </span>
            </button>
          </div>

          <div className="mt-7 rounded-2xl border-2 border-[#b88a44] bg-[#241409] p-4 text-amber-100 shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleLimit(12);
                  }}
                  placeholder={tr(
                    '카드명, 캐릭터명, 능력 키워드 검색 (예: 카단, 도발, 용족)',
                    'Search card name, character, or keyword (e.g. Kadan, Taunt, Dragon)',
                  )}
                  className="w-full rounded-xl border border-amber-500/40 bg-black/50 py-2.5 pl-9 pr-3 text-sm font-bold text-amber-50 placeholder-amber-200/45 focus:border-amber-300 focus:outline-none"
                />
              </div>

              <div className="flex flex-wrap items-center gap-1.5">
                {(
                  [
                    { id: 'ALL', ko: '전체 등급', en: 'All Rarities' },
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
                    className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
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

            <div className="mt-3 flex flex-wrap gap-1.5 border-t border-amber-500/20 pt-3">
              <button
                type="button"
                onClick={() => {
                  setFilterClass('ALL');
                  setVisibleLimit(12);
                }}
                className={`rounded-lg px-3 py-1.5 text-xs font-extrabold transition ${
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
                  className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition ${
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
                className={`inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-xs font-extrabold transition ${
                  filterClass === 'NEUTRAL'
                    ? 'bg-sky-500 text-white'
                    : 'bg-black/40 text-amber-200/80 hover:bg-amber-950'
                }`}
              >
                <img src={CLASS_CREST_URL.NEUTRAL} alt="" className="h-4 w-4 rounded-full" />
                <span>{tr('중립 (157)', 'Neutral (157)')}</span>
              </button>
            </div>
          </div>

          {cardsLoading ? (
            <div className="py-16 text-center text-sm font-extrabold text-[#5c3a1a]">
              {tr('382종 눈히어로 카드 데이터를 불러오는 중입니다...', 'Loading 382 SNSHero cards...')}
            </div>
          ) : displayedCards.length === 0 ? (
            <div className="mt-8 rounded-2xl border-2 border-dashed border-[#a67c3b] bg-[#fbf1da]/70 py-14 text-center">
              <p className="text-base font-extrabold text-[#3c230d]">
                {tr('조건에 맞는 카드가 없습니다.', 'No cards match your current filters.')}
              </p>
              <button
                type="button"
                onClick={() => {
                  setFilterClass('ALL');
                  setFilterRarity('ALL');
                  setSearchQuery('');
                }}
                className="hs-promo-cta-teal mt-4 rounded-full px-5 py-2 text-xs font-extrabold"
              >
                {tr('필터 초기화', 'Reset Filters')}
              </button>
            </div>
          ) : (
            <>
              <div className="mt-10 flex flex-wrap items-center justify-center gap-x-6 gap-y-12 pt-4 sm:gap-x-8 sm:gap-y-14">
                {displayedCards.map((c) => (
                  <PromoCard
                    key={c.id}
                    card={c}
                    isGolden={showGolden}
                    onClick={setZoomedCard}
                    size="md"
                  />
                ))}
              </div>

              <div className="mt-10 flex flex-col items-center gap-3">
                <div className="text-xs font-extrabold text-[#5c3a1a]">
                  {tr(
                    `현재 ${displayedCards.length}장 / 검색 결과 총 ${filteredCards.length}장 표시 중`,
                    `Showing ${displayedCards.length} of ${filteredCards.length} matching cards`,
                  )}
                </div>
                {visibleLimit < filteredCards.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((n) => n + 12)}
                    className="hs-promo-cta-teal rounded-full px-7 py-2.5 text-sm font-extrabold"
                  >
                    {tr('카드 더 보기 (+12장)', 'Load More Cards (+12)')}
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          8. Game Modes Section
      ===================================================================== */}
      <section id="modes" className="hs-promo-tavern py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
              {tr('플레이 방식', 'WAYS TO PLAY')}
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              {tr('게임 모드', 'Game Modes')}
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-amber-100/80 sm:text-base">
              {tr(
                '정통 1배 룰로 전설 등급에 도전하는 랭킹대전부터, 9종족 AI 격파, 40부작 카단의 여정 스토리모드까지 원하는 방식으로 즐기세요!',
                "Climb the Ranked ladder with classic 1x rules, sharpen your decks against 9 AI champions, or conquer the 40-episode Kadan's Journey.",
              )}
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {/* Mode 1 */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_ranked_battle.png"
                    alt={tr('랭킹대전', 'Ranked Play')}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  {tr('직업 선택 및 덱 구성 · 정통 1배 룰', 'Deck Building · Classic 1x Competitive Rules')}
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {tr('랭킹대전 (등급전 · 일반전)', 'Ranked & Casual Play')}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  {tr(
                    '9대 종족 중 원하는 영웅과 30장 덱을 선택해 25등급 수습생부터 최고 영예인 ‘전설의 눈히어로’까지 등반하세요. 매 1승마다 +25 골드와 등급 별(★)을 획득하며, 3연승 시 별 +2 보너스 및 3승 달성마다 +30G 추가 보상이 지급됩니다.',
                    'Choose any of the 9 Factions with a 30-card deck and climb from Rank 25 Apprentice all the way to Legend Hero. Earn +25 Gold per win, Win-Streak bonus stars, and +30G every 3 victories.',
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=ranked"
                    className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>{tr('랭킹대전 도전', 'Enter Ranked Play')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Mode 2 */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="order-2 lg:order-1 lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  {tr('가볍게 한 판 플레이 · 9종족 수호자 정복', 'Solo Practice · Defeat All 9 Champions')}
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {tr('AI대전 (일반 AI · 숙련 AI)', 'Practice vs AI (Normal · Expert)')}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  {tr(
                    '물·불·바람·땅·인간·언데드·엘프·드워프·동물 9대 종족 영웅과 언제든 맞붙어 새 덱을 실험하고 실력을 갈고닦으세요. 각 종족 최초 제압 시 +25G~+50G 보너스, 숙련 AI 9개 종족 올클리어 시 눈히어로 카드 팩 2개가 추가 지급됩니다!',
                    'Test custom decks anytime against all 9 Faction AI opponents. Earn +25G–+50G first-clear rewards per champion and 2 Bonus Card Packs for sweeping Expert AI.',
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=ai"
                    className="hs-promo-cta-teal-dark inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>{tr('AI대전 수련하기', 'Train vs AI')}</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div className="order-1 lg:order-2 lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_ai_battle.png"
                    alt={tr('AI대전', 'AI Battle')}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Mode 3 */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_story_battle.png"
                    alt={tr('스토리모드 카단의 여정', "Story Mode Kadan's Journey")}
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                  {tr('40화 풀보이스 극장 · 3장=3배 각성 · 무한 환생', '40-EP Story Theater · 3x Awakening · Reincarnation')}
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  {tr('스토리모드 (카단의 여정)', "Story Mode (Kadan's Journey)")}
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  {tr(
                    '1화 엘윈마을의 습격부터 40화 최종 결전까지! 5컷 웹툰과 남성 성우 내레이션 극장을 감상하고 원작 보스와 결투하세요. 보유한 동일 카드 3장이 3배로 각성하는 여정 전용 법칙과 매 5화 보스 팩 보상, 40화 완주 후 환생 모드가 기다립니다.',
                    'Begin with the Episode 0 Tutorial alongside Kazan & the Scarecrow Bot, then battle all 40 episodes! Unlock 3x Awakening multipliers, milestone boss packs, and Infinite Reincarnation.',
                  )}
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=story"
                    className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>{tr('1화부터 여정 시작', 'Start Story Mode')}</span>
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
          9. Bottom Conversion CTA
      ===================================================================== */}
      <section
        id="packs"
        style={{ backgroundImage: `url(${SNS_LOCATIONS.PACK_ALTAR})` }}
        className="relative overflow-hidden bg-cover bg-center py-20 sm:py-28"
      >
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at center, rgba(251, 191, 36, 0.22) 0%, rgba(16, 9, 4, 0.85) 68%, rgba(8, 5, 2, 0.96) 100%)',
          }}
        />
        <div className="relative z-10 mx-auto flex max-w-5xl flex-col items-center px-4 text-center sm:px-6">
          <div className="mb-8 flex items-center justify-center gap-4 sm:gap-6">
            <img
              src={SNS_CARD_BACK_THEMES.silver.imageUrl}
              alt={tr(SNS_CARD_BACK_THEMES.silver.name, 'Silver Guardian Card Back')}
              className="hidden h-36 w-auto -rotate-12 rounded-xl shadow-2xl sm:block"
            />
            <div className="h-44 w-32 sm:h-52 sm:w-36">
              <SnsBoosterPackArt glowing />
            </div>
            <img
              src={SNS_CARD_BACK_THEMES.bronze.imageUrl}
              alt={tr(SNS_CARD_BACK_THEMES.bronze.name, 'Elwin Bronze Card Back')}
              className="hidden h-36 w-auto rotate-12 rounded-xl shadow-2xl sm:block"
            />
          </div>

          <h2 className="promo-outline text-3xl font-black text-white sm:text-5xl">
            {tr('다들 엘윈마을로 모이세요!', 'Pull Up a Chair in Elwin Village!')}
          </h2>
          <p className="promo-outline mt-4 max-w-2xl text-sm font-bold leading-relaxed text-amber-100/90 sm:text-lg">
            {tr(
              '게임에 뛰어들어 주문을 시전하고, 382종의 강력한 하수인을 소환하며, 적을 제압하세요! 지금 접속하면 무료 눈히어로 카드 팩 ',
              'Dive straight into strategic battles, unleash powerful spells, and summon 382 original minions! Claim ',
            )}
            <strong className="text-amber-300">{tr('3개', '3 Free Packs')}</strong>
            {tr('를 즉시 개봉할 수 있습니다.', ' immediately on arrival.')}
          </p>
          <a
            href="/game.html"
            className="hs-promo-cta-purple mt-8 inline-flex min-h-[56px] items-center gap-2.5 rounded-full px-10 py-4 text-base font-extrabold tracking-wide sm:text-lg"
          >
            <Gamepad2 className="h-5 w-5" />
            <span>{tr('지금 무료로 플레이', 'Play Free Now')}</span>
          </a>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          10. Recommended Universe & Footer
      ===================================================================== */}
      <section id="universe" className="bg-[#0b101d] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-400">
              {tr('눈히어로와 함께 즐기는 세계관', 'EXPANDED SNSHERO UNIVERSE')}
            </div>
            <h2 className="mt-1.5 text-3xl font-black text-white sm:text-4xl">
              {tr('추천 콘텐츠 & 공식 미디어 믹스', 'Official Novel, Webtoon & Channels')}
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <BookOpen className="h-5 w-5 text-amber-300" />,
                title: tr('웹소설', 'Web Novel'),
                sub: tr('40부작 공식 판타지 웹소설 · /book.html 바로 감상', '40-Episode Fantasy Novel · Read at /book.html'),
                img: '/webtoon-assets/episode_01/scene_04.webp',
                href: '/book.html',
                external: false,
              },
              {
                icon: <Layers className="h-5 w-5 text-sky-300" />,
                title: tr('웹툰', 'Webtoon'),
                sub: tr('카단과 이그니스의 서사를 /webtoon.html 에서 감상', 'Read the full illustrated series at /webtoon.html'),
                img: '/webtoon-assets/episode_01/scene_14.webp',
                href: '/webtoon.html',
                external: false,
              },
              {
                icon: <BookOpen className="h-5 w-5 text-emerald-300" />,
                title: tr('네이버웹소설', 'Naver Web Novel'),
                sub: tr('네이버 챌린지리그 공식 연재처 바로가기', 'Official Naver Challenge League serialization'),
                img: '/webtoon-assets/episode_01/scene_06.webp',
                href: 'https://novel.naver.com/challenge/list?novelId=1250635',
                external: true,
              },
              {
                icon: <Layers className="h-5 w-5 text-green-400" />,
                title: tr('네이버웹툰', 'Naver Webtoon'),
                sub: tr('네이버 도전만화 공식 연재처 바로가기', 'Official Naver Challenge Comic series'),
                img: '/webtoon-assets/episode_01/scene_01.webp',
                href: 'https://comic.naver.com/challenge/list?titleId=857363',
                external: true,
              },
            ].map((item) => (
              <a
                key={item.href}
                href={item.href}
                target={item.external ? '_blank' : undefined}
                rel={item.external ? 'noopener noreferrer' : undefined}
                className="group overflow-hidden rounded-2xl border border-slate-700/80 bg-[#12192c] transition hover:-translate-y-1.5 hover:border-amber-400/70"
              >
                <div className="aspect-[16/10] overflow-hidden bg-black">
                  <img
                    src={item.img}
                    alt={item.title}
                    className="h-full w-full object-cover transition duration-300 group-hover:scale-105"
                  />
                </div>
                <div className="p-4">
                  <div className="flex items-center gap-2 text-sm font-extrabold text-white">
                    {item.icon}
                    <span>{item.title}</span>
                  </div>
                  <p className="mt-1.5 text-xs font-bold text-slate-300/80">{item.sub}</p>
                </div>
              </a>
            ))}
          </div>

          <div className="hs-promo-gold-frame mt-14 rounded-2xl bg-gradient-to-b from-[#462914] via-[#2c180a] to-[#1a0d05] p-6 text-center">
            <h3 className="text-xl font-black text-amber-200">
              {tr('공식 연재 · 소셜 서비스', 'Official Channels & Community')}
            </h3>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-extrabold">
              <a
                href="https://novel.naver.com/challenge/list?novelId=1250635"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                {tr('네이버 웹소설', 'Naver Web Novel')}
              </a>
              <a
                href="https://comic.naver.com/challenge/list?titleId=857363"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                {tr('네이버 웹툰', 'Naver Webtoon')}
              </a>
              <a
                href="https://nlink.munpia.com/link/munpia/novel/616551"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                {tr('문피아 웹소설', 'Munpia Novel')}
              </a>
              <a
                href="https://www.youtube.com/@snshero"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                YouTube (@snshero)
              </a>
              <a
                href="https://github.com/Dayyoung/snshero"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                {tr('GitHub 오픈소스', 'GitHub Open Source')}
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Global Footer + Language Switcher
      ===================================================================== */}
      <footer className="border-t border-amber-900/50 bg-[#151210] px-4 py-12 text-center text-xs text-stone-400">
        <div className="mx-auto max-w-4xl">
          <img
            src={SNS_LOGO_URL}
            alt={tr('눈히어로', 'SNSHero')}
            className="mx-auto h-10 w-auto opacity-90"
          />
          <div className="mt-5 flex flex-wrap justify-center gap-5 font-bold text-stone-300">
            <a href="/" className="hover:text-amber-300">{tr('게임 바로 시작 (/)', 'Play (/)')}</a>
            <a href="/game.html" className="hover:text-amber-300">{tr('게임 실행 (/game.html)', 'Launch Game')}</a>
            <a href="/game.html?mode=story" className="hover:text-amber-300">{tr('스토리모드', 'Story Mode')}</a>
            <a href="/game.html?mode=ranked" className="hover:text-amber-300">{tr('랭킹대전', 'Ranked Play')}</a>
            <a href="/game.html?mode=ai" className="hover:text-amber-300">{tr('AI대전', 'AI Battle')}</a>
            <a href="/stone.html" className="hover:text-amber-300">{tr('오리지널 스톤', 'Classic Stone')}</a>
            <a href="/book.html" className="hover:text-amber-300">{tr('공식 웹소설', 'Official Novel')}</a>
            <a href="/webtoon.html" className="hover:text-amber-300">{tr('공식 웹툰', 'Official Webtoon')}</a>
          </div>

          <div
            data-testid="footer-language-switcher"
            className="mt-6 flex items-center justify-center gap-2"
          >
            <span className="inline-flex items-center gap-1 text-[11px] font-bold text-stone-400">
              <Globe className="h-3.5 w-3.5 text-amber-400" />
              <span>{tr('언어 선택', 'Language')}:</span>
            </span>
            <button
              type="button"
              data-testid="footer-lang-en"
              onClick={() => setLang('en')}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-extrabold transition ${
                lang === 'en'
                  ? 'border-amber-400 bg-amber-500 text-[#1b0f05]'
                  : 'border-amber-500/30 bg-black/40 text-amber-200 hover:border-amber-400'
              }`}
            >
              English
            </button>
            <button
              type="button"
              data-testid="footer-lang-ko"
              onClick={() => setLang('ko')}
              className={`rounded-md border px-3 py-1.5 text-[11px] font-extrabold transition ${
                lang === 'ko'
                  ? 'border-amber-400 bg-amber-500 text-[#1b0f05]'
                  : 'border-amber-500/30 bg-black/40 text-amber-200 hover:border-amber-400'
              }`}
            >
              한국어
            </button>
          </div>

          <p className="mt-6 leading-relaxed text-stone-500">
            {tr('본 페이지는 웹 카드 배틀 게임 ', 'Official showcase for web card battle game ')}
            <strong className="text-stone-300">
              {tr('눈히어로 — 엘윈마을의 영웅들 (/game.html)', 'SNSHero — Heroes of Elwin Village (/game.html)')}
            </strong>
            {tr(' 공식 소개 페이지입니다.', '.')}
            <br />
            {tr(
              '모든 카드 수집·덱·전적 데이터는 100% 브라우저 로컬스토리지(hero_hs_*)에 안전하게 영구 저장됩니다.',
              'All cards, decks, and match records are 100% saved locally in browser LocalStorage (hero_hs_*).',
            )}
          </p>
          <p className="mt-3 text-[11px] text-stone-600">
            © 2026 SNSHero (SNSHero.com) · Heroes of Elwin Village & Kadan&apos;s Journey. All rights reserved.
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
              className="absolute right-4 top-4 inline-flex h-9 w-9 items-center justify-center rounded-full border border-amber-400/50 bg-black/50 text-amber-200 hover:bg-black"
            >
              <X className="h-4 w-4" />
            </button>

            <div className="flex items-center justify-center pt-5 sm:col-span-5">
              <PromoCard card={zoomedCard} isGolden={showGolden} size="lg" />
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
                      {tr('제작 비용', 'Craft')}:{' '}
                      <strong className="text-sky-300">
                        {CRAFTING_COST[zoomedCard.rarity]} {tr('가루', 'Dust')}
                      </strong>
                    </div>
                    <div className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2">
                      {tr('추출 획득', 'Disenchant')}:{' '}
                      <strong className="text-amber-300">
                        {DISENCHANT_VALUE[zoomedCard.rarity]} {tr('가루', 'Dust')}
                      </strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  href="/game.html"
                  className="hs-promo-cta-purple inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold"
                >
                  <span>{tr('game.html에서 카드 얻기', 'Collect Card in Game')}</span>
                  <ChevronRight className="h-4 w-4" />
                </a>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
