import { getCurrentLanguage, SupportedLanguage, tr } from './i18n';

export type ReaderMode = 'book' | 'webtoon';

const SNS_LOGO_URL = '/hs-assets/brand/logo-ko.webp';

let mobileMenuOpen = false;

export function toggleReaderMobileMenu(): void {
  mobileMenuOpen = !mobileMenuOpen;
}

export function closeReaderMobileMenu(): void {
  mobileMenuOpen = false;
}

export function renderReaderHeader(mode: ReaderMode): string {
  const lang = getCurrentLanguage();

  const langBtn = (code: SupportedLanguage, text: string) => {
    const active = lang === code;
    return `<button type="button" data-action="reader-set-lang" data-lang="${code}" class="px-2 py-1 text-[11px] font-extrabold rounded-full cursor-pointer transition ${
      active
        ? 'bg-amber-400 text-[#1b120b] shadow-sm'
        : 'text-amber-200/80 hover:text-amber-100 hover:bg-white/10'
    }">${text}</button>`;
  };

  return `
    <header class="hs-promo-nav sticky top-0 z-50 w-full">
      <div class="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:h-[70px] sm:px-6">
        <!-- Brand Logo (matches promo.html) -->
        <a href="/promo.html" class="flex items-center gap-2.5 group no-underline">
          <img
            src="/icon.png"
            alt="${tr('눈히어로', 'SNSHero')}"
            class="h-9 w-9 rounded-lg border border-amber-300/60 shadow transition-transform group-hover:scale-105"
          />
          <img
            src="${SNS_LOGO_URL}"
            alt="${tr('눈히어로 엘윈마을 카드 배틀', 'SNSHero Elwin Village Card Battle')}"
            class="h-8 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:h-9"
          />
        </a>

        <!-- Desktop Nav Links (matches promo.html) -->
        <nav class="hidden items-center gap-6 text-sm font-extrabold tracking-wide text-amber-100/90 lg:flex" aria-label="Primary Navigation">
          <a href="/promo.html#intro" class="transition hover:text-amber-300 no-underline">${tr('게임 정보', 'Game Info', 'ゲーム情報')}</a>
          <a href="/promo.html#latest" class="transition hover:text-amber-300 no-underline">${tr('신규 콘텐츠', 'Latest', '新着コンテンツ')}</a>
          <a href="/promo.html#heroes" class="transition hover:text-amber-300 no-underline">${tr('9대 영웅', '9 Heroes', '9大ヒーロー')}</a>
          <a href="/promo.html#cards" class="transition hover:text-amber-300 no-underline">${tr('카드 라이브러리', 'Cards', 'カード一覧')}</a>
          <a href="/promo.html#modes" class="transition hover:text-amber-300 no-underline">${tr('게임 모드', 'Modes', 'ゲームモード')}</a>
          <a href="/promo.html#universe" class="transition hover:text-amber-300 no-underline">${tr('미디어 믹스', 'Universe', 'メディアミックス')}</a>
        </nav>

        <!-- Right CTA & Mobile Menu Toggle (matches promo.html) -->
        <div class="flex items-center gap-2 sm:gap-2.5">
          <div class="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-black/35 p-0.5">
            ${langBtn('en', 'EN')}
            ${langBtn('ko', 'KO')}
          </div>

          <a
            href="/book.html"
            class="hidden items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition no-underline sm:inline-flex ${
              mode === 'book'
                ? 'border-amber-300 bg-amber-900/70 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                : 'border-amber-300/40 bg-black/30 text-amber-200 hover:border-amber-300 hover:bg-amber-950/60'
            }"
          >
            <span>📖 ${tr('공식 소설', 'Novel', '公式小説')}</span>
          </a>
          <a
            href="/webtoon.html"
            class="hidden items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition no-underline md:inline-flex ${
              mode === 'webtoon'
                ? 'border-sky-300 bg-sky-900/70 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'border-sky-300/40 bg-black/30 text-sky-200 hover:border-sky-300 hover:bg-sky-950/60'
            }"
          >
            <span>🖼️ ${tr('공식 웹툰', 'Webtoon', '公式ウェブトゥーン')}</span>
          </a>
          <a
            href="/game.html"
            class="hs-promo-cta-purple inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold tracking-wide no-underline sm:px-6 sm:py-2.5 sm:text-sm"
          >
            <span>${tr('지금 플레이', 'Play Now', '今すぐプレイ')}</span>
            <span>›</span>
          </a>
          <button
            type="button"
            data-action="reader-toggle-menu"
            aria-label="${tr('메뉴 열기', 'Toggle Menu', 'メニューを開く')}"
            class="inline-flex h-10 w-10 items-center justify-center rounded-lg border border-amber-400/40 bg-black/40 text-amber-200 lg:hidden cursor-pointer"
          >
            ${mobileMenuOpen ? '✕' : '☰'}
          </button>
        </div>
      </div>

      ${
        mobileMenuOpen
          ? `
        <div class="border-t border-amber-500/30 bg-[#1a0f08]/98 px-4 py-4 lg:hidden">
          <div class="grid grid-cols-2 gap-2 text-sm font-extrabold text-amber-100">
            <a href="/promo.html#intro" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('게임 정보', 'Game Info', 'ゲーム情報')}</a>
            <a href="/promo.html#latest" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('신규 콘텐츠', 'Latest', '新着コンテンツ')}</a>
            <a href="/promo.html#heroes" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('9대 영웅', '9 Heroes', '9大ヒーロー')}</a>
            <a href="/promo.html#cards" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('카드 라이브러리', 'Cards', 'カード一覧')}</a>
            <a href="/promo.html#modes" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('게임 모드', 'Modes', 'ゲームモード')}</a>
            <a href="/promo.html#universe" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('미디어 믹스', 'Universe', 'メディアミックス')}</a>
            <a href="/book.html" class="rounded-lg border ${mode === 'book' ? 'border-amber-400 bg-amber-900/50 text-amber-100' : 'border-amber-500/20 bg-black/30 text-amber-100'} px-3 py-2.5 text-center transition hover:border-amber-400 no-underline">${tr('웹소설 40부작', 'Novel 40 EP', '小説全40話')}</a>
            <a href="/webtoon.html" class="rounded-lg border ${mode === 'webtoon' ? 'border-sky-400 bg-sky-900/50 text-sky-100' : 'border-amber-500/20 bg-black/30 text-amber-100'} px-3 py-2.5 text-center transition hover:border-amber-400 no-underline">${tr('공식 웹툰', 'Webtoon', '公式ウェブトゥーン')}</a>
            <a href="/stone.html" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('오리지널 스톤', 'Classic Stone', 'クラシック')}</a>
            <a href="/game.html" class="rounded-lg border border-purple-400/50 bg-purple-950/60 px-3 py-2.5 text-center transition hover:border-purple-300 no-underline text-purple-100">${tr('게임 바로 시작', 'Play Game', 'ゲーム開始')}</a>
          </div>
          <div class="mt-3 flex items-center justify-center gap-2 sm:hidden">
            ${langBtn('en', 'English (EN)')}
            ${langBtn('ko', '한국어 (KO)')}
          </div>
        </div>
      `
          : ''
      }
    </header>
  `;
}

export function renderReaderFooter(): string {
  const lang = getCurrentLanguage();
  const footerLangBtn = (code: SupportedLanguage, label: string) => {
    const active = lang === code;
    return `<button type="button" data-action="reader-set-lang" data-lang="${code}" class="px-3.5 py-1.5 text-xs font-extrabold rounded-full border cursor-pointer transition ${
      active
        ? 'border-amber-300 bg-amber-400 text-[#1b120b] shadow-sm'
        : 'border-amber-500/35 bg-black/40 text-stone-300 hover:border-amber-300 hover:text-amber-100'
    }">${label}</button>`;
  };

  return `
    <footer class="border-t border-amber-900/50 bg-[#151210] px-4 py-12 text-center text-xs text-stone-400 mt-auto">
      <div class="mx-auto max-w-4xl">
        <img
          src="${SNS_LOGO_URL}"
          alt="${tr('눈히어로', 'SNSHero')}"
          class="mx-auto h-10 w-auto opacity-90"
        />
        <div class="mt-5 flex flex-wrap justify-center gap-5 font-bold text-stone-300">
          <a href="/" class="hover:text-amber-300 no-underline text-stone-300">${tr('게임 바로 시작 (/)', 'Play Game (/)', 'ゲーム開始 (/)')}</a>
          <a href="/game.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('게임 실행 (/game.html)', 'Play (/game.html)', 'ゲーム実行')}</a>
          <a href="/promo.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('게임 소개 (/promo.html)', 'Promo (/promo.html)', '公式紹介')}</a>
          <a href="/game.html?mode=story" class="hover:text-amber-300 no-underline text-stone-300">${tr('스토리모드', 'Story Mode', 'ストーリー')}</a>
          <a href="/game.html?mode=ranked" class="hover:text-amber-300 no-underline text-stone-300">${tr('랭킹대전', 'Ranked', 'ランク戦')}</a>
          <a href="/game.html?mode=ai" class="hover:text-amber-300 no-underline text-stone-300">${tr('AI대전', 'AI Battle', 'AI対戦')}</a>
          <a href="/stone.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('오리지널 스톤', 'Classic Stone', 'クラシック')}</a>
          <a href="/book.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('공식 웹소설', 'Web Novel', '公式小説')}</a>
          <a href="/webtoon.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('공식 웹툰', 'Webtoon', '公式ウェブトゥーン')}</a>
        </div>
        <div class="mt-6 flex flex-wrap items-center justify-center gap-2" data-testid="footer-language-switcher">
          <span class="text-[11px] font-bold uppercase tracking-wider text-stone-400 mr-1">${tr('언어 선택', 'Language')}:</span>
          ${footerLangBtn('en', 'English')}
          ${footerLangBtn('ko', '한국어')}
        </div>
        <p class="mt-6 leading-relaxed text-stone-500">
          ${tr(
            '본 페이지는 웹 카드 배틀 게임 <strong class="text-stone-300">눈히어로 — 엘윈마을의 영웅들 (/game.html)</strong> 공식 미디어 믹스 리더입니다.',
            'Official media mix reader for the web card battle game <strong class="text-stone-300">SNSHero — Heroes of Elwin (/game.html)</strong>.',
            '本ページはウェブカードバトルゲーム <strong class="text-stone-300">SNSHero (/game.html)</strong> 公式メディアミックスリーダーです。'
          )}
          <br />
          ${tr(
            '모든 카드 수집·덱·전적 데이터는 100% 브라우저 로컬스토리지(<code>hero_hs_*</code>)에 안전하게 영구 저장됩니다.',
            'All card collection, deck, and match records are securely saved in browser localStorage (<code>hero_hs_*</code>).',
            'すべてのカード・デッキ・戦績データはブラウザのローカルストレージに保存されます。'
          )}
        </p>
        <p class="mt-3 text-[11px] text-stone-600">
          ${tr(
            '© 2026 눈히어로 (SNSHero.com) · 엘윈마을과 카단의 여정. All rights reserved.',
            "© 2026 SNSHero (SNSHero.com) · Elwin Village & Kadan's Journey. All rights reserved."
          )}
        </p>
      </div>
    </footer>
  `;
}
