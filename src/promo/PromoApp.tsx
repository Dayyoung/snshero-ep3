import React, { useEffect, useMemo, useState } from 'react';
import {
  BookOpen,
  ChevronRight,
  Compass,
  Crown,
  Film,
  Flame,
  Gamepad2,
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
  CLASSIC_HEROES,
  CardRarity,
  ClassicCardDef,
  HERO_CLASS_ORDER,
  HeroClass,
} from '../hearthstone/types';
import { PROMO_RACE_KO, PROMO_RARITY_KO, PromoCard } from './PromoCard';

type FeatureTabId = 'story' | 'awake' | 'pack';

const FEATURE_TABS: {
  id: FeatureTabId;
  title: string;
  eyebrow: string;
  headline: string;
  desc: string;
  bullets: string[];
  imageUrl: string;
  ctaText: string;
  ctaHref: string;
}[] = [
  {
    id: 'story',
    title: '40화 웹툰 극장 & 보스 레이드',
    eyebrow: '카단의 여정 · 풀보이스 스토리모드',
    headline: '원작 40부작 서사를 전장에서 직접 돌파하세요!',
    desc: '매 에피소드마다 5컷 기승전결 웹툰과 스튜디오 한국어 남성 성우 내레이션 200트랙이 상영됩니다. 야심가 루시안, 데스나이트 아르투스, 대심판관 말라카이 등 40화 적장들과 직접 결투하고 보스 팩을 획득하세요.',
    bullets: [
      '매 5화 돌파 시 눈히어로 카드 팩 +1개 보너스',
      '40화 완주 시 +300G & 3팩 지급 + 무한 환생 모드 개방',
      '스마트 자동플레이 기본 탑재로 누구나 부담 없이 감상·전투',
    ],
    imageUrl: '/hs-assets/screenshots/ingame_story_theater.png',
    ctaText: '스토리모드 바로 출정',
    ctaHref: '/game.html?mode=story',
  },
  {
    id: 'awake',
    title: "여정 전용 '3장 = 3배' 각성 법칙",
    eyebrow: '중복 카드가 곧 압도적 전력으로',
    headline: '카드를 3장 모으면 공격력과 생명력이 3배로 폭발합니다!',
    desc: '스토리모드(카단의 여정)에서는 동일 하수인·무기를 3장 이상(전설은 2장 이상) 보유할 경우 보유 장수 배율(×3, ×4, ×N배)로 능력치가 증폭됩니다. 패배해도 골드 보급팩 개봉으로 즉시 덱이 강해집니다.',
    bullets: [
      '랭킹대전·AI대전은 정통 1배 룰로 공정한 실력 대결 보장',
      '스토리모드 전용 중복 각성으로 40화·환생 고난이도 돌파',
      '여분 분해 시 여정 3배 배수 영향을 사전에 명확히 안내',
    ],
    imageUrl: '/hs-assets/screenshots/ingame_collection_awake.png',
    ctaText: '내 덱 강화하러 가기',
    ctaHref: '/game.html',
  },
  {
    id: 'pack',
    title: '382종 고유 아트 & 황금 천장 엔진',
    eyebrow: '9대 종족 × 25장 + 중립 157장',
    headline: '첫 10팩 내 첫 전설 확정, 전 등급 중복 방지 보급!',
    desc: '9개 종족의 대표 영웅과 충원 영웅 225장, 그리고 판타지 중립 카드 157장까지 총 382종 전수 고유 일러스트가 수록되어 있습니다. 팩 개봉 시 여관주인의 실제 호명 대사와 24K 황금 포일 카드를 만나보세요.',
    bullets: [
      '신규 방문 즉시 무료 카드 팩 3팩 즉시 지급',
      '첫 10팩 이내 전설 100% 확정 · 40팩 전설 천장 · 중복 방지',
      '불필요한 카드는 신비한 가루로 추출해 원하는 전설 직접 제작',
    ],
    imageUrl: '/hs-assets/screenshots/ingame_pack_altar.png',
    ctaText: '무료 3팩 개봉하기',
    ctaHref: '/game.html',
  },
];

const STORY_BOSS_HIGHLIGHTS = [
  { name: '심연화신 루시안', role: '붉은 유리 궁정 재상 · 최종 흑막', img: '/hs-assets/bosses/boss_abyss_lucian.webp' },
  { name: '대심판관 말라카이', role: '광휘 신전 이단심문관', img: '/hs-assets/bosses/boss_malakai.webp' },
  { name: '환각마녀 모르가나', role: '안개 늪의 환술 지배자', img: '/hs-assets/bosses/boss_morgana.webp' },
  { name: '수문장 발타자르', role: '심연 관문의 강철 수호자', img: '/hs-assets/bosses/boss_balthazar.webp' },
];

const YOUTUBE_PLAYLIST_URL = 'https://www.youtube.com/@snshero/playlists';

const TRAILER_CLIPS = [
  {
    id: 'ep1',
    label: '제1화 · 눈보라 아래 두 서약',
    youtubeId: 'KOf8IAic2QY',
    embedUrl: 'https://www.youtube.com/embed/KOf8IAic2QY?list=PLVch67W9z4TA&rel=0&modestbranding=1',
  },
  {
    id: 'ep8',
    label: '제8화 · 붉은 갈기의 기수',
    youtubeId: 'BIHe4MrtCIw',
    embedUrl: 'https://www.youtube.com/embed/BIHe4MrtCIw?list=PLVch67W9z4TA&rel=0&modestbranding=1',
  },
  {
    id: 'ep15',
    label: '제15화 · 독사와 사자의 밤',
    youtubeId: 'LHHngbtkJwg',
    embedUrl: 'https://www.youtube.com/embed/LHHngbtkJwg?list=PLVch67W9z4TA&rel=0&modestbranding=1',
  },
];

export const PromoApp: React.FC = () => {
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
          const hay = `${c.name} ${c.text} ${c.snsCharName || ''} ${c.snsFactionKo || ''}`.toLowerCase();
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

  const activeFeature = FEATURE_TABS.find((t) => t.id === activeFeatureTab) || FEATURE_TABS[0];
  const activeClip = TRAILER_CLIPS[activeClipIdx] || TRAILER_CLIPS[0];

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
              alt="눈히어로"
              className="h-9 w-9 rounded-lg border border-amber-300/60 shadow transition-transform group-hover:scale-105"
            />
            <img
              src={SNS_LOGO_URL}
              alt="눈히어로 엘윈마을 카드 배틀"
              className="h-8 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:h-9"
            />
          </a>

          {/* Desktop Nav Links */}
          <nav className="hidden items-center gap-6 text-sm font-extrabold tracking-wide text-amber-100/90 lg:flex">
            <a href="#intro" className="transition hover:text-amber-300">게임 정보</a>
            <a href="#latest" className="transition hover:text-amber-300">신규 콘텐츠</a>
            <a href="#heroes" className="transition hover:text-amber-300">9대 영웅</a>
            <a href="#cards" className="transition hover:text-amber-300">카드 라이브러리</a>
            <a href="#modes" className="transition hover:text-amber-300">게임 모드</a>
            <a href="#universe" className="transition hover:text-amber-300">미디어 믹스</a>
          </nav>

          {/* Right CTA & Mobile Menu Toggle */}
          <div className="flex items-center gap-2.5">
            <a
              href="/book.html"
              className="hidden items-center gap-1 rounded-full border border-amber-300/40 bg-black/30 px-3.5 py-1.5 text-xs font-extrabold text-amber-200 transition hover:border-amber-300 hover:bg-amber-950/60 sm:inline-flex"
            >
              <BookOpen className="h-3.5 w-3.5" />
              <span>공식 소설</span>
            </a>
            <a
              href="/webtoon.html"
              className="hidden items-center gap-1 rounded-full border border-sky-300/40 bg-black/30 px-3.5 py-1.5 text-xs font-extrabold text-sky-200 transition hover:border-sky-300 hover:bg-sky-950/60 md:inline-flex"
            >
              <Layers className="h-3.5 w-3.5" />
              <span>공식 웹툰</span>
            </a>
            <a
              href="/game.html"
              className="hs-promo-cta-purple inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold tracking-wide sm:px-6 sm:py-2.5 sm:text-sm"
            >
              <span>지금 플레이</span>
              <ChevronRight className="h-4 w-4" />
            </a>
            <button
              type="button"
              onClick={() => setMobileMenuOpen((v) => !v)}
              aria-label="메뉴 열기"
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
                { href: '#intro', label: '게임 정보' },
                { href: '#latest', label: '신규 콘텐츠' },
                { href: '#heroes', label: '9대 영웅' },
                { href: '#cards', label: '카드 라이브러리' },
                { href: '#modes', label: '게임 모드' },
                { href: '#universe', label: '미디어 믹스' },
                { href: '/book.html', label: '웹소설 40부작' },
                { href: '/webtoon.html', label: '공식 웹툰' },
                { href: '/stone.html', label: '오리지널 스톤' },
                { href: '/', label: '게임 바로 시작' },
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
        {/* Warm Hearth Radial Vignette */}
        <div
          className="pointer-events-none absolute inset-0"
          style={{
            background:
              'radial-gradient(ellipse at 50% 44%, rgba(251, 191, 36, 0.2) 0%, rgba(20, 11, 5, 0.72) 55%, rgba(10, 6, 3, 0.96) 100%)',
          }}
        />

        {/* Floating Embers */}
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

        {/* Flanking Hero Key Art: 카단 (Left) & 이그니스 (Right) */}
        <img
          src={CLASSIC_HEROES.PRIEST.heroCutoutUrl}
          alt={CLASSIC_HEROES.PRIEST.nameKo}
          className="pointer-events-none absolute -bottom-4 -left-10 h-[250px] w-auto object-contain opacity-30 drop-shadow-[0_18px_36px_rgba(0,0,0,0.95)] sm:-left-6 sm:h-[340px] sm:opacity-55 lg:left-[-2%] lg:h-[470px] lg:opacity-95 xl:left-[2%] xl:h-[540px]"
        />
        <img
          src={CLASSIC_HEROES.WARRIOR.heroCutoutUrl}
          alt={CLASSIC_HEROES.WARRIOR.nameKo}
          className="pointer-events-none absolute -bottom-4 -right-12 h-[250px] w-auto object-contain opacity-30 drop-shadow-[0_18px_36px_rgba(0,0,0,0.95)] sm:-right-6 sm:h-[340px] sm:opacity-55 lg:right-[-2%] lg:h-[470px] lg:opacity-95 xl:right-[2%] xl:h-[540px]"
        />

        {/* Center Hero Focal Stack */}
        <div className="relative z-10 mx-auto flex max-w-3xl flex-col items-center text-center">
          <div className="mb-3 inline-flex items-center gap-2 rounded-full border border-amber-300/50 bg-[#140b05]/85 px-4 py-1.5 text-xs font-extrabold tracking-[0.16em] text-amber-200 shadow-lg">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span>ELWIN VILLAGE • 382 CARDS • 9 FACTIONS</span>
          </div>

          <div className="relative mb-3 flex items-center justify-center">
            <div className="pointer-events-none absolute -inset-8 rounded-full bg-amber-400/20 blur-2xl" />
            <img
              src={SNS_LOGO_URL}
              alt="눈히어로"
              className="relative w-[270px] max-w-[82vw] drop-shadow-[0_16px_32px_rgba(0,0,0,0.95)] sm:w-[420px]"
            />
          </div>

          <div className="mb-4 flex items-center gap-3">
            <SnsSnowCompassSeal size={36} />
            <span className="promo-outline text-sm font-extrabold tracking-[0.22em] text-amber-200 sm:text-base">
              엘윈마을의 영웅들 · 카단과 이그니스의 여정
            </span>
            <SnsSnowCompassSeal size={36} />
          </div>

          <h1 className="promo-outline break-keep text-3xl font-black leading-tight text-white sm:text-4xl lg:text-5xl">
            놀랄 만큼 쉽고
            <br /> 믿기 힘들 만큼 재미있습니다
          </h1>

          <p className="promo-outline mt-4 max-w-2xl text-sm font-bold leading-relaxed text-amber-100/90 sm:text-lg">
            전략 카드 게임 • 무료 웹 플레이 • 첫 방문 3카드팩 즉시 지급
          </p>

          {/* Hero Primary Pill CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <a
              href="/game.html"
              className="hs-promo-cta-purple inline-flex min-h-[52px] items-center gap-2.5 rounded-full px-9 py-3.5 text-base font-extrabold tracking-wide sm:text-lg"
            >
              <Gamepad2 className="h-5 w-5" />
              <span>지금 플레이</span>
            </a>
            <a
              href="/game.html?mode=story"
              className="hs-promo-cta-teal-dark inline-flex min-h-[52px] items-center gap-2 rounded-full px-7 py-3.5 text-sm font-extrabold sm:text-base"
            >
              <Swords className="h-4 w-4" />
              <span>카단의 여정 1화 체험</span>
            </a>
          </div>

          {/* Platform Badges */}
          <div className="mt-6 flex flex-wrap items-center justify-center gap-2 text-[11px] font-bold text-amber-200/80">
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">PC · Mac 브라우저</span>
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">iOS · Android PWA 전체화면</span>
            <span className="rounded-full border border-amber-400/30 bg-black/45 px-3 py-1">100% 로컬스토리지 영구 저장</span>
          </div>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          3. Intro Section ("엘윈마을 성소에 어서 오세요!")
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
          {/* Left Copy */}
          <div className="lg:col-span-5">
            <div className="mb-2 text-xs font-extrabold uppercase tracking-[0.2em] text-amber-400">
              WELCOME TO ELWIN SANCTUARY
            </div>
            <h2 className="promo-outline text-3xl font-black text-amber-50 sm:text-4xl">
              엘윈마을 성소에 어서 오세요!
            </h2>
            <p className="mt-4 text-base leading-relaxed text-amber-100/85">
              검은 집어넣고 덱을 뽑으세요. <strong className="text-amber-300">눈히어로</strong>의 시간입니다!
              전설적인 전략이 부딪히는 전투에서 비전 주문을 시전하고, 382종의 고유 하수인을 소환하며,
              물·불·바람·땅·인간·언데드·엘프·드워프·동물 9대 종족의 수호자들을 지휘하세요.
            </p>
            <div className="mt-6 grid grid-cols-2 gap-3 text-xs font-extrabold">
              <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                <div className="text-lg text-amber-300">382장</div>
                <div className="mt-0.5 text-amber-100/80">9종족 225 + 중립 157</div>
              </div>
              <div className="rounded-xl border border-amber-400/30 bg-black/45 p-3">
                <div className="text-lg text-sky-300">40부작</div>
                <div className="mt-0.5 text-amber-100/80">풀보이스 5컷 웹툰 극장</div>
              </div>
            </div>
            <div className="mt-7 flex flex-wrap gap-3">
              <a
                href="/game.html"
                className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold"
              >
                <span>성소 입장하기</span>
                <ChevronRight className="h-4 w-4" />
              </a>
              <a
                href="#heroes"
                className="hs-promo-cta-teal-dark inline-flex items-center gap-2 rounded-full px-6 py-3 text-sm font-extrabold"
              >
                <span>9대 종족 영웅 보기</span>
              </a>
            </div>
          </div>

          {/* Right Gold-Framed YouTube Webtoon Player */}
          <div className="lg:col-span-7">
            <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
              <div className="relative aspect-video w-full overflow-hidden bg-black">
                <iframe
                  key={activeClip.youtubeId}
                  src={activeClip.embedUrl}
                  title={`눈히어로 공식 웹툰 - ${activeClip.label}`}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
                  allowFullScreen
                  loading="lazy"
                  className="h-full w-full border-0"
                />
              </div>
              {/* Trailer Clip Selector Bar */}
              <div className="flex flex-wrap items-center justify-between gap-2 border-t border-amber-500/40 bg-[#1a0f07] px-3 py-2.5">
                <a
                  href={YOUTUBE_PLAYLIST_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-extrabold text-amber-300 underline decoration-amber-400/50 underline-offset-4 hover:text-amber-200"
                >
                  유튜브 공식 웹툰 재생목록 ↗
                </a>
                <div className="flex flex-wrap gap-1.5">
                  {TRAILER_CLIPS.map((clip, idx) => (
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
          4. Latest Content / Story Showcase ("최신 개발사항 · 신규 콘텐츠")
      ===================================================================== */}
      <section id="latest" className="hs-promo-parchment py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
              최신 연대기 · 핵심 시스템
            </div>
            <h2 className="promo-outline-dark mt-1.5 text-3xl font-black text-[#2b1707] sm:text-5xl">
              신규 콘텐츠: 카단의 여정
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-[#5c3a1a] sm:text-base">
              오직 눈히어로(game.html)에서만 만날 수 있는 40부작 서사 보스전, 3장=3배 각성, 382종 고유 카드 시스템을 확인하세요.
            </p>
          </div>

          {/* Interactive Feature Tabs (Accordion / Showcase Style) */}
          <div className="mt-10 grid grid-cols-1 gap-3 sm:grid-cols-3">
            {FEATURE_TABS.map((tab) => {
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

          {/* Active Feature Showcase Card */}
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
                    <span>382종 카드 보기</span>
                  </a>
                </div>
              </div>
            </div>
          </div>

          {/* 4-Col Story Bosses / Highlights Grid */}
          <div className="mt-10">
            <div className="mb-4 flex items-center justify-between">
              <h3 className="text-xl font-black text-[#2b1707] sm:text-2xl">
                카단의 여정 주요 적장 & 레이드 보스
              </h3>
              <a
                href="/game.html?mode=story"
                className="hs-promo-cta-teal rounded-full px-4 py-1.5 text-xs font-extrabold"
              >
                전체 도전하기
              </a>
            </div>
            <div className="grid grid-cols-2 gap-4 lg:grid-cols-4">
              {STORY_BOSS_HIGHLIGHTS.map((boss) => (
                <a
                  key={boss.name}
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
          5. Gameplay Pillars ("게임 특징")
      ===================================================================== */}
      <section id="features" className="hs-promo-cosmic py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-indigo-300">
              CORE PILLARS
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              게임 특징
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-indigo-100/80 sm:text-base">
              눈히어로는 랭킹대전 전설을 노리는 전략가든, 가볍게 카단의 여정을 즐기는 팬이든 누구나 원하는 방식으로 플레이할 수 있습니다.
            </p>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <Flame className="h-7 w-7 text-amber-300" />,
                title: '부담없는 무설치 재미',
                desc: '회원가입이나 다운로드 없이 브라우저에서 즉시 실행! 모든 카드와 전적이 로컬스토리지에 안전하게 영구 보존됩니다.',
              },
              {
                icon: <Trophy className="h-7 w-7 text-sky-300" />,
                title: '무료로 플레이하고 승리하세요',
                desc: '일일 의뢰·랭킹전·AI대전·스토리모드로 골드와 카드 팩을 획득하고 382종 고유 카드를 무료로 수집하세요.',
              },
              {
                icon: <Swords className="h-7 w-7 text-emerald-300" />,
                title: '바로 시작하기 & 스마트 AI',
                desc: '직관적인 마나 수정 룰과 모드별 자동플레이 지원! 초보자도 입문 가이드를 따라 1분 만에 박진감 넘치는 결투를 즐깁니다.',
              },
              {
                icon: <Shield className="h-7 w-7 text-purple-300" />,
                title: '플랫폼 간 완벽한 최적화',
                desc: '데스크톱, 태블릿, 스마트폰 세로/가로 전체화면 PWA 지원과 데미지 비례 타격 진동·성우 풀보이스를 제공합니다.',
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
          6. 9대 종족 & 대표 영웅 인터랙티브 쇼케이스
      ===================================================================== */}
      <section id="heroes" className="hs-promo-tavern py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
              9 FACTIONS & HEROES
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              9대 종족 & 전설 영웅
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-amber-100/80 sm:text-base">
              각 종족을 이끄는 대표 영웅을 선택해 고유 영웅 능력과 대표 카드를 확인해 보세요.
            </p>
          </div>

          {/* 9 Faction Crest Selector */}
          <div className="mt-8 flex flex-wrap justify-center gap-2 sm:gap-3">
            {HERO_CLASS_ORDER.map((cls) => {
              const h = CLASSIC_HEROES[cls];
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
                    alt={h.classNameKo}
                    className="h-6 w-6 rounded-full object-cover"
                  />
                  <span>{h.classNameKo}</span>
                  <span className="hidden text-[11px] opacity-80 sm:inline">({h.nameKo})</span>
                </button>
              );
            })}
          </div>

          {/* Selected Hero Spotlight Panel */}
          <div
            style={{ background: selectedHero.frameGradient }}
            className="hs-promo-gold-frame mt-8 overflow-hidden rounded-3xl p-[2px]"
          >
            <div className="grid grid-cols-1 items-center gap-6 rounded-[21px] bg-[#140c07]/92 p-5 sm:p-8 lg:grid-cols-12">
              {/* Hero Cutout & Bust */}
              <div className="relative flex flex-col items-center justify-center lg:col-span-4">
                <div
                  style={{ backgroundColor: selectedHero.accentColor }}
                  className="pointer-events-none absolute inset-6 rounded-full opacity-20 blur-3xl"
                />
                <img
                  src={selectedHero.heroCutoutUrl}
                  alt={selectedHero.nameKo}
                  className="relative max-h-[340px] w-auto object-contain drop-shadow-[0_18px_28px_rgba(0,0,0,0.92)]"
                />
              </div>

              {/* Hero Lore & Power + 3 Iconic Class Cards */}
              <div className="lg:col-span-8">
                <div className="flex flex-wrap items-center gap-2.5">
                  <img
                    src={CLASS_CREST_URL[selectedHero.heroClass]}
                    alt={selectedHero.classNameKo}
                    className="h-8 w-8 rounded-full border border-amber-300/70"
                  />
                  <span className="rounded-full border border-amber-400/50 bg-black/45 px-3 py-0.5 text-xs font-extrabold text-amber-300">
                    {selectedHero.classNameKo} · 거점: {selectedHero.factionRealmKo}
                  </span>
                </div>

                <h3 className="mt-3 text-2xl font-black text-white sm:text-4xl">
                  {selectedHero.nameKo}
                  <span className="ml-2.5 block text-base font-bold text-amber-300 sm:inline sm:text-lg">
                    — {selectedHero.titleKo}
                  </span>
                </h3>

                <blockquote className="mt-3 border-l-4 border-amber-400/70 pl-3.5 text-sm font-bold italic text-amber-100/90">
                  “{selectedHero.emotesKo.start}”
                </blockquote>

                {/* Hero Power Box */}
                <div className="mt-5 flex flex-col gap-3 rounded-2xl border border-amber-400/35 bg-black/45 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <div className="text-[11px] font-extrabold uppercase tracking-wider text-sky-300">
                      고유 영웅 능력 (2 마나)
                    </div>
                    <div className="mt-0.5 text-base font-extrabold text-white">
                      {selectedHero.heroPowerNameKo}
                      <span className="ml-2 text-sm font-bold text-amber-200">
                        — {selectedHero.heroPowerTextKo}
                      </span>
                    </div>
                  </div>
                  <a
                    href="/game.html?mode=ranked"
                    className="hs-promo-cta-purple inline-flex shrink-0 items-center justify-center gap-1.5 rounded-full px-5 py-2.5 text-xs font-extrabold"
                  >
                    <span>{selectedHero.nameKo} 덱 플레이</span>
                    <ChevronRight className="h-3.5 w-3.5" />
                  </a>
                </div>

                {/* 3 Iconic Class Cards (Exact game.html HearthstoneCard) */}
                <div className="mt-6">
                  <div className="mb-4 text-xs font-extrabold uppercase tracking-wider text-amber-300/90">
                    {selectedHero.classNameKo} 대표 카드 (클릭하여 상세 보기)
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
          7. 382종 눈히어로 카드 라이브러리 쇼케이스
      ===================================================================== */}
      <section id="cards" className="hs-promo-parchment py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="flex flex-col items-center justify-between gap-4 text-center md:flex-row md:text-left">
            <div>
              <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-[#8b5a1b]">
                OFFICIAL CARD LIBRARY
              </div>
              <h2 className="promo-outline-dark mt-1 text-3xl font-black text-[#2b1707] sm:text-4xl">
                눈히어로 382종 카드 도감
              </h2>
              <p className="mt-1.5 text-sm font-bold text-[#5c3a1a]">
                game.html에 수록된 실제 382장 카드(9종족 × 25장 + 중립 157장)를 미리 살펴보고 황금 포일까지 확인하세요.
              </p>
            </div>

            {/* Golden Foil Preview Toggle */}
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
              <span>{showGolden ? '24K 황금 카드 미리보기 ON' : '24K 황금 카드 미리보기'}</span>
            </button>
          </div>

          {/* Filter Toolbar */}
          <div className="mt-7 rounded-2xl border-2 border-[#b88a44] bg-[#241409] p-4 text-amber-100 shadow-xl">
            <div className="flex flex-col gap-3 lg:flex-row lg:items-center lg:justify-between">
              {/* Search Box */}
              <div className="relative flex-1 max-w-md">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-amber-300/70" />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => {
                    setSearchQuery(e.target.value);
                    setVisibleLimit(12);
                  }}
                  placeholder="카드명, 캐릭터명, 능력 키워드 검색 (예: 카단, 도발, 용족)"
                  className="w-full rounded-xl border border-amber-500/40 bg-black/50 py-2.5 pl-9 pr-3 text-sm font-bold text-amber-50 placeholder-amber-200/45 focus:border-amber-300 focus:outline-none"
                />
              </div>

              {/* Rarity Filter Pills */}
              <div className="flex flex-wrap items-center gap-1.5">
                {[
                  { id: 'ALL', label: '전체 등급' },
                  { id: 'LEGENDARY', label: '전설' },
                  { id: 'EPIC', label: '특급' },
                  { id: 'RARE', label: '희귀' },
                  { id: 'COMMON', label: '일반' },
                  { id: 'FREE', label: '기본' },
                ].map((r) => (
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
                    {r.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Class Filter Tabs */}
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
                전체 (382)
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
                  <span>{CLASSIC_HEROES[cls].classNameKo}</span>
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
                <span>중립 (157)</span>
              </button>
            </div>
          </div>

          {/* Card Grid */}
          {cardsLoading ? (
            <div className="py-16 text-center text-sm font-extrabold text-[#5c3a1a]">
              382종 눈히어로 카드 데이터를 불러오는 중입니다...
            </div>
          ) : displayedCards.length === 0 ? (
            <div className="mt-8 rounded-2xl border-2 border-dashed border-[#a67c3b] bg-[#fbf1da]/70 py-14 text-center">
              <p className="text-base font-extrabold text-[#3c230d]">조건에 맞는 카드가 없습니다.</p>
              <button
                type="button"
                onClick={() => {
                  setFilterClass('ALL');
                  setFilterRarity('ALL');
                  setSearchQuery('');
                }}
                className="hs-promo-cta-teal mt-4 rounded-full px-5 py-2 text-xs font-extrabold"
              >
                필터 초기화
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
                  현재 {displayedCards.length}장 / 검색 결과 총 {filteredCards.length}장 표시 중
                </div>
                {visibleLimit < filteredCards.length && (
                  <button
                    type="button"
                    onClick={() => setVisibleLimit((n) => n + 12)}
                    className="hs-promo-cta-teal rounded-full px-7 py-2.5 text-sm font-extrabold"
                  >
                    카드 더 보기 (+12장)
                  </button>
                )}
              </div>
            </>
          )}
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          8. Game Modes Section ("플레이 방식 / 게임 모드" — Zigzag Layout)
      ===================================================================== */}
      <section id="modes" className="hs-promo-tavern py-16 sm:py-24">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-amber-400">
              플레이 방식
            </div>
            <h2 className="promo-outline mt-1.5 text-3xl font-black text-white sm:text-5xl">
              게임 모드
            </h2>
            <p className="mx-auto mt-3 max-w-2xl text-sm font-bold text-amber-100/80 sm:text-base">
              정통 1배 룰로 전설 등급에 도전하는 랭킹대전부터, 9종족 AI 격파, 40부작 카단의 여정 스토리모드까지 원하는 방식으로 즐기세요!
            </p>
          </div>

          <div className="mt-12 space-y-12">
            {/* Mode 1: Ranked / Casual */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_ranked_battle.png"
                    alt="랭킹대전"
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-amber-400">
                  직업 선택 및 덱 구성 · 정통 1배 룰
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  랭킹대전 (등급전 · 일반전)
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  9대 종족 중 원하는 영웅과 30장 덱을 선택해 25등급 수습생부터 최고 영예인 ‘전설의 눈히어로’까지 등반하세요. 매 1승마다 +25 골드와 등급 별(★)을 획득하며, 3연승 시 별 +2 보너스 및 3승 달성마다 +30G 추가 보상이 지급됩니다.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=ranked"
                    className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>랭킹대전 도전</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
            </div>

            {/* Mode 2: AI Battle (Reversed Zigzag) */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="order-2 lg:order-1 lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-emerald-300">
                  가볍게 한 판 플레이 · 9종족 수호자 정복
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  AI대전 (일반 AI · 숙련 AI)
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  물·불·바람·땅·인간·언데드·엘프·드워프·동물 9대 종족 영웅과 언제든 맞붙어 새 덱을 실험하고 실력을 갈고닦으세요. 각 종족 최초 제압 시 +25G~+50G 보너스, 숙련 AI 9개 종족 올클리어 시 눈히어로 카드 팩 2개가 추가 지급됩니다!
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=ai"
                    className="hs-promo-cta-teal-dark inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>AI대전 수련하기</span>
                    <ChevronRight className="h-4 w-4" />
                  </a>
                </div>
              </div>
              <div className="order-1 lg:order-2 lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_ai_battle.png"
                    alt="AI대전"
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
            </div>

            {/* Mode 3: Story Mode (Kadan's Journey 40 Episodes) */}
            <div className="grid grid-cols-1 items-center gap-8 lg:grid-cols-12">
              <div className="lg:col-span-6">
                <div className="hs-promo-gold-frame overflow-hidden rounded-2xl bg-black">
                  <img
                    src="/hs-assets/screenshots/ingame_story_battle.png"
                    alt="스토리모드 카단의 여정"
                    className="aspect-video w-full object-cover"
                  />
                </div>
              </div>
              <div className="lg:col-span-6">
                <div className="text-xs font-extrabold uppercase tracking-wider text-sky-300">
                  40화 풀보이스 극장 · 3장=3배 각성 · 무한 환생
                </div>
                <h3 className="mt-1.5 text-2xl font-black text-white sm:text-3xl">
                  스토리모드 (카단의 여정)
                </h3>
                <p className="mt-3 text-sm leading-relaxed text-amber-100/85 sm:text-base">
                  1화 엘윈마을의 습격부터 40화 최종 결전까지! 5컷 웹툰과 스튜디오 남성 성우 내레이션 극장을 감상하고 원작 보스와 결투하세요. 보유한 동일 카드 3장이 3배로 각성하는 여정 전용 법칙과 매 5화 보스 팩 보상, 40화 완주 후 환생 모드가 기다립니다.
                </p>
                <div className="mt-5 flex flex-wrap gap-3">
                  <a
                    href="/game.html?mode=story"
                    className="hs-promo-cta-purple inline-flex items-center gap-2 rounded-full px-6 py-2.5 text-sm font-extrabold"
                  >
                    <span>1화부터 여정 시작</span>
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
          9. Bottom Conversion CTA ("다들 엘윈마을로 모이세요!")
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
          {/* Booster Pack + 3 Official Card Backs Fan */}
          <div className="mb-8 flex items-center justify-center gap-4 sm:gap-6">
            <img
              src={SNS_CARD_BACK_THEMES.silver.imageUrl}
              alt={SNS_CARD_BACK_THEMES.silver.name}
              className="hidden h-36 w-auto -rotate-12 rounded-xl shadow-2xl sm:block"
            />
            <div className="h-44 w-32 sm:h-52 sm:w-36">
              <SnsBoosterPackArt glowing />
            </div>
            <img
              src={SNS_CARD_BACK_THEMES.bronze.imageUrl}
              alt={SNS_CARD_BACK_THEMES.bronze.name}
              className="hidden h-36 w-auto rotate-12 rounded-xl shadow-2xl sm:block"
            />
          </div>

          <h2 className="promo-outline text-3xl font-black text-white sm:text-5xl">
            다들 엘윈마을로 모이세요!
          </h2>
          <p className="promo-outline mt-4 max-w-2xl text-sm font-bold leading-relaxed text-amber-100/90 sm:text-lg">
            게임에 뛰어들어 주문을 시전하고, 382종의 강력한 하수인을 소환하며, 적을 제압하세요!
            지금 접속하면 무료 눈히어로 카드 팩 <strong className="text-amber-300">3개</strong>를 즉시 개봉할 수 있습니다.
          </p>
          <a
            href="/game.html"
            className="hs-promo-cta-purple mt-8 inline-flex min-h-[56px] items-center gap-2.5 rounded-full px-10 py-4 text-base font-extrabold tracking-wide sm:text-lg"
          >
            <Gamepad2 className="h-5 w-5" />
            <span>지금 무료로 플레이</span>
          </a>
        </div>
      </section>

      <div className="hs-promo-divider" />

      {/* =====================================================================
          10. Recommended Universe & Social Wooden Plaque + Footer
      ===================================================================== */}
      <section id="universe" className="bg-[#0b101d] py-16 sm:py-20">
        <div className="mx-auto max-w-6xl px-4 sm:px-6">
          <div className="text-center">
            <div className="text-xs font-extrabold uppercase tracking-[0.22em] text-sky-400">
              눈히어로와 함께 즐기는 세계관
            </div>
            <h2 className="mt-1.5 text-3xl font-black text-white sm:text-4xl">
              추천 콘텐츠 & 공식 미디어 믹스
            </h2>
          </div>

          <div className="mt-10 grid grid-cols-1 gap-5 sm:grid-cols-2 lg:grid-cols-4">
            {[
              {
                icon: <BookOpen className="h-5 w-5 text-amber-300" />,
                title: '웹소설',
                sub: '40부작 공식 판타지 웹소설 · /book.html 바로 감상',
                img: '/webtoon-assets/episode_01/scene_04.webp',
                href: '/book.html',
                external: false,
              },
              {
                icon: <Layers className="h-5 w-5 text-sky-300" />,
                title: '웹툰',
                sub: '카단과 이그니스의 서사를 /webtoon.html 에서 감상',
                img: '/webtoon-assets/episode_01/scene_14.webp',
                href: '/webtoon.html',
                external: false,
              },
              {
                icon: <BookOpen className="h-5 w-5 text-emerald-300" />,
                title: '네이버웹소설',
                sub: '네이버 챌린지리그 공식 연재처 바로가기',
                img: '/webtoon-assets/episode_01/scene_06.webp',
                href: 'https://novel.naver.com/challenge/list?novelId=1250635',
                external: true,
              },
              {
                icon: <Layers className="h-5 w-5 text-green-400" />,
                title: '네이버웹툰',
                sub: '네이버 도전만화 신규 공식 연재처 바로가기',
                img: '/webtoon-assets/episode_01/scene_01.webp',
                href: 'https://comic.naver.com/challenge/list?titleId=857363',
                external: true,
              },
            ].map((item) => (
              <a
                key={item.title}
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

          {/* Wooden Plaque Social Banner */}
          <div className="hs-promo-gold-frame mt-14 rounded-2xl bg-gradient-to-b from-[#462914] via-[#2c180a] to-[#1a0d05] p-6 text-center">
            <h3 className="text-xl font-black text-amber-200">공식 연재 · 소셜 서비스</h3>
            <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-xs font-extrabold">
              <a
                href="https://novel.naver.com/challenge/list?novelId=1250635"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                네이버 웹소설
              </a>
              <a
                href="https://comic.naver.com/challenge/list?titleId=857363"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                네이버 웹툰
              </a>
              <a
                href="https://nlink.munpia.com/link/munpia/novel/616551"
                target="_blank"
                rel="noopener noreferrer"
                className="rounded-full border border-amber-300/50 bg-black/40 px-4 py-2 text-amber-100 transition hover:bg-amber-500 hover:text-[#1b0f05]"
              >
                문피아 웹소설
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
                GitHub 오픈소스
              </a>
            </div>
          </div>
        </div>
      </section>

      {/* =====================================================================
          Global Footer
      ===================================================================== */}
      <footer className="border-t border-amber-900/50 bg-[#151210] px-4 py-12 text-center text-xs text-stone-400">
        <div className="mx-auto max-w-4xl">
          <img
            src={SNS_LOGO_URL}
            alt="눈히어로"
            className="mx-auto h-10 w-auto opacity-90"
          />
          <div className="mt-5 flex flex-wrap justify-center gap-5 font-bold text-stone-300">
            <a href="/" className="hover:text-amber-300">게임 바로 시작 (/)</a>
            <a href="/game.html" className="hover:text-amber-300">게임 실행 (/game.html)</a>
            <a href="/game.html?mode=story" className="hover:text-amber-300">스토리모드</a>
            <a href="/game.html?mode=ranked" className="hover:text-amber-300">랭킹대전</a>
            <a href="/game.html?mode=ai" className="hover:text-amber-300">AI대전</a>
            <a href="/stone.html" className="hover:text-amber-300">오리지널 스톤</a>
            <a href="/book.html" className="hover:text-amber-300">공식 웹소설</a>
            <a href="/webtoon.html" className="hover:text-amber-300">공식 웹툰</a>
          </div>
          <p className="mt-6 leading-relaxed text-stone-500">
            본 페이지는 웹 카드 배틀 게임 <strong className="text-stone-300">눈히어로 — 엘윈마을의 영웅들 (/game.html)</strong> 공식 소개 페이지입니다.
            <br />
            모든 카드 수집·덱·전적 데이터는 100% 브라우저 로컬스토리지(`hero_hs_*`)에 안전하게 영구 저장됩니다.
          </p>
          <p className="mt-3 text-[11px] text-stone-600">
            © 2026 눈히어로 (SNSHero.com) · 엘윈마을과 카단의 여정. All rights reserved.
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
              aria-label="닫기"
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
                    {zoomedCard.cardClass !== 'NEUTRAL' && zoomedCard.cardClass !== 'DREAM'
                      ? CLASSIC_HEROES[zoomedCard.cardClass as HeroClass].classNameKo
                      : '중립 카드'}
                    {' · '}
                    {PROMO_RARITY_KO[zoomedCard.rarity]?.label}
                    {zoomedCard.race ? ` · ${PROMO_RACE_KO[zoomedCard.race] || zoomedCard.race}` : ''}
                  </span>
                </div>

                <h3 className="mt-2 text-2xl font-black text-white">
                  {zoomedCard.name}
                </h3>

                <div className="mt-3 rounded-xl border border-amber-500/30 bg-black/40 p-3 text-sm leading-relaxed text-amber-100">
                  <div
                    dangerouslySetInnerHTML={{
                      __html:
                        formatCardHtmlText(zoomedCard.text) ||
                        (zoomedCard.type === 'WEAPON'
                          ? `영웅 장착 무기 (공격력 ${zoomedCard.attack ?? 0} / 내구도 ${getCardBaseDurability(zoomedCard)})`
                          : '강력한 기본 전투력을 갖춘 영웅 하수인입니다.'),
                    }}
                  />
                </div>

                {zoomedCard.flavor && (
                  <p className="mt-3 text-xs italic leading-relaxed text-amber-200/75">
                    “{zoomedCard.flavor}”
                  </p>
                )}

                {CRAFTING_COST[zoomedCard.rarity] && (
                  <div className="mt-4 grid grid-cols-2 gap-2 text-xs font-bold">
                    <div className="rounded-lg border border-sky-400/30 bg-sky-950/40 px-3 py-2">
                      제작 비용: <strong className="text-sky-300">{CRAFTING_COST[zoomedCard.rarity]} 가루</strong>
                    </div>
                    <div className="rounded-lg border border-amber-400/30 bg-amber-950/40 px-3 py-2">
                      추출 획득: <strong className="text-amber-300">{DISENCHANT_VALUE[zoomedCard.rarity]} 가루</strong>
                    </div>
                  </div>
                )}
              </div>

              <div className="mt-6 flex flex-wrap gap-2.5">
                <a
                  href="/game.html"
                  className="hs-promo-cta-purple inline-flex flex-1 items-center justify-center gap-2 rounded-full px-5 py-3 text-sm font-extrabold"
                >
                  <span>game.html에서 카드 얻기</span>
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
