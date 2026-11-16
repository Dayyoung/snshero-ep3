import { getCurrentLanguage, SupportedLanguage, tr } from './i18n';
import {
  initAdSenseContainmentObserver,
  isAdRemoved,
  isDesktopWideLandscape,
  protectLinksFromVignette,
  pushAdSenseTags,
  syncAdSenseRatioLayout,
} from '../hearthstone/services/adsenseManager';

export type ReaderMode = 'book' | 'webtoon';

const SNS_LOGO_KO_URL = '/hs-assets/brand/logo-ko.webp';
const SNS_LOGO_EN_URL = '/hs-assets/brand/logo-en.webp';
const getLogoUrl = (lang: SupportedLanguage) => (lang === 'en' ? SNS_LOGO_EN_URL : SNS_LOGO_KO_URL);

let mobileMenuOpen = false;

export function toggleReaderMobileMenu(): void {
  mobileMenuOpen = !mobileMenuOpen;
}

export function closeReaderMobileMenu(): void {
  mobileMenuOpen = false;
}

const BOOK_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>`;
const LAYERS_ICON = `<svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2" stroke-linecap="round" stroke-linejoin="round" class="h-3.5 w-3.5 shrink-0"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>`;
const CHEVRON_RIGHT = `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" class="h-4 w-4 shrink-0"><polyline points="9 18 15 12 9 6"/></svg>`;

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
        <!-- Brand Logo (matches /, no /icon.png) -->
        <a href="/" class="flex items-center gap-2.5 group no-underline">
          <img
            src="${getLogoUrl(lang)}"
            alt="${tr('눈히어로 엘윈마을 카드 배틀', 'SNSHero Elwin Village Card Battle')}"
            class="h-12 w-auto object-contain drop-shadow-[0_2px_6px_rgba(0,0,0,0.9)] sm:h-[54px] transition-transform group-hover:scale-105"
          />
        </a>

        <!-- Desktop Nav Links (exact same Korean/English labels as /) -->
        <nav class="hidden items-center gap-6 text-sm font-extrabold tracking-wide text-amber-100/90 lg:flex" aria-label="Primary Navigation">
          <a href="/#intro" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('게임 정보', 'Overview')}</a>
          <a href="/#latest" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('신규 콘텐츠', 'Features')}</a>
          <a href="/#heroes" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('9대 영웅', '9 Heroes')}</a>
          <a href="/#cards" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('카드 라이브러리', 'Card Library')}</a>
          <a href="/#modes" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('게임 모드', 'Game Modes')}</a>
          <a href="/#universe" class="transition hover:text-amber-300 no-underline text-amber-100/90">${tr('미디어 믹스', 'Universe')}</a>
        </nav>

        <!-- Right CTA & Mobile Menu Toggle (matches /) -->
        <div class="flex items-center gap-2 sm:gap-2.5">
          <div class="hidden sm:inline-flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-black/35 p-0.5">
            ${langBtn('ko', 'KO')}
            ${langBtn('en', 'EN')}
          </div>

          <a
            href="/book"
            class="hidden items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition no-underline sm:inline-flex ${
              mode === 'book'
                ? 'border-amber-300 bg-amber-900/70 text-amber-100 shadow-[0_0_12px_rgba(245,158,11,0.35)]'
                : 'border-amber-300/40 bg-black/30 text-amber-200 hover:border-amber-300 hover:bg-amber-950/60'
            }"
          >
            ${BOOK_ICON}
            <span>${tr('공식 소설', 'Novel')}</span>
          </a>
          <a
            href="/webtoon"
            class="hidden items-center gap-1 rounded-full border px-3.5 py-1.5 text-xs font-extrabold transition no-underline md:inline-flex ${
              mode === 'webtoon'
                ? 'border-sky-300 bg-sky-900/70 text-sky-100 shadow-[0_0_12px_rgba(56,189,248,0.35)]'
                : 'border-sky-300/40 bg-black/30 text-sky-200 hover:border-sky-300 hover:bg-sky-950/60'
            }"
          >
            ${LAYERS_ICON}
            <span>${tr('공식 웹툰', 'Webtoon')}</span>
          </a>
          <a
            href="/game"
            class="hs-promo-cta-purple inline-flex items-center gap-1.5 rounded-full px-4 py-2 text-xs font-extrabold tracking-wide no-underline sm:px-6 sm:py-2.5 sm:text-sm"
          >
            <span>${tr('지금 플레이', 'Play Now')}</span>
            ${CHEVRON_RIGHT}
          </a>
          <button
            type="button"
            data-action="reader-toggle-menu"
            aria-label="${tr('메뉴 열기', 'Toggle Menu')}"
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
            <a href="/#intro" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('게임 정보', 'Overview')}</a>
            <a href="/#latest" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('신규 콘텐츠', 'Features')}</a>
            <a href="/#heroes" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('9대 영웅', '9 Heroes')}</a>
            <a href="/#cards" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('카드 라이브러리', 'Card Library')}</a>
            <a href="/#modes" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('게임 모드', 'Game Modes')}</a>
            <a href="/#universe" data-action="reader-close-menu" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('미디어 믹스', 'Universe')}</a>
            <a href="/book" class="rounded-lg border ${mode === 'book' ? 'border-amber-400 bg-amber-900/50 text-amber-100' : 'border-amber-500/20 bg-black/30 text-amber-100'} px-3 py-2.5 text-center transition hover:border-amber-400 no-underline">${tr('웹소설 40부작', 'Novel 40 EP')}</a>
            <a href="/webtoon" class="rounded-lg border ${mode === 'webtoon' ? 'border-sky-400 bg-sky-900/50 text-sky-100' : 'border-amber-500/20 bg-black/30 text-amber-100'} px-3 py-2.5 text-center transition hover:border-amber-400 no-underline">${tr('공식 웹툰', 'Webtoon')}</a>
            <a href="/stone.html" class="rounded-lg border border-amber-500/20 bg-black/30 px-3 py-2.5 text-center transition hover:border-amber-400 no-underline text-amber-100">${tr('오리지널 스톤', 'Classic Stone')}</a>
            <a href="/game" class="rounded-lg border border-purple-400/50 bg-purple-950/60 px-3 py-2.5 text-center transition hover:border-purple-300 no-underline text-purple-100">${tr('게임 바로 시작', 'Play Now')}</a>
          </div>
          <div class="mt-3 flex items-center justify-center gap-2 sm:hidden">
            ${langBtn('ko', '한국어 (KO)')}
            ${langBtn('en', 'English (EN)')}
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
  const footerLangBtn = (code: SupportedLanguage, text: string) => {
    const active = lang === code;
    return `<button type="button" data-action="reader-set-lang" data-lang="${code}" class="px-2.5 py-1 text-[11px] font-extrabold rounded-full cursor-pointer transition ${
      active
        ? 'bg-amber-400 text-[#1b120b] shadow-sm'
        : 'text-amber-200/80 hover:text-amber-100 hover:bg-white/10'
    }">${text}</button>`;
  };

  return `
    <footer class="border-t border-amber-900/50 bg-[#151210] px-4 py-12 text-center text-xs text-stone-400 mt-auto">
      <div class="mx-auto max-w-4xl">
        <img
          src="${getLogoUrl(lang)}"
          alt="${tr('눈히어로', 'SNSHero')}"
          class="mx-auto h-10 w-auto opacity-90"
        />
        <div class="mt-5 flex flex-wrap justify-center gap-5 font-bold text-stone-300">
          <a href="/game" class="hover:text-amber-300 no-underline text-stone-300">${tr('게임 바로 시작 (/game)', 'Play Now (/game)')}</a>
          <a href="/" class="hover:text-amber-300 no-underline text-stone-300">${tr('게임 소개 (/)', 'Overview (/)')}</a>
          <a href="/game?mode=story" class="hover:text-amber-300 no-underline text-stone-300">${tr('스토리모드', 'Story Mode')}</a>
          <a href="/game?mode=ranked" class="hover:text-amber-300 no-underline text-stone-300">${tr('랭킹대전', 'Ranked Play')}</a>
          <a href="/game?mode=ai" class="hover:text-amber-300 no-underline text-stone-300">${tr('AI대전', 'Practice vs AI')}</a>
          <a href="/stone.html" class="hover:text-amber-300 no-underline text-stone-300">${tr('오리지널 스톤', 'Classic Stone')}</a>
          <a href="/book" class="hover:text-amber-300 no-underline text-stone-300">${tr('공식 소설', 'Novel')}</a>
          <a href="/webtoon" class="hover:text-amber-300 no-underline text-stone-300">${tr('공식 웹툰', 'Webtoon')}</a>
        </div>
        <div class="mt-5 flex justify-center">
          <div class="inline-flex items-center gap-0.5 rounded-full border border-amber-400/30 bg-black/35 p-0.5">
            ${footerLangBtn('ko', 'KO')}
            ${footerLangBtn('en', 'EN')}
          </div>
        </div>
        <p class="mt-6 leading-relaxed text-stone-500">
          ${tr(
            '본 페이지는 웹 카드 배틀 게임 <strong class="text-stone-300">눈히어로 — 엘윈마을의 영웅들 (/)</strong> 공식 미디어 믹스 리더입니다.',
            'Official media mix reader for the web card battle game <strong class="text-stone-300">SNSHero — Heroes of Elwin (/)</strong>.'
          )}
        </p>
        <p class="mt-3 text-[11px] text-stone-600">
          © 2026 눈히어로 (SNSHero.com) · 엘윈마을과 카단의 여정. All rights reserved.
        </p>
      </div>
    </footer>
  `;
}

let readerShellBoundMode: ReaderMode | null = null;

/**
 * Ensures the persistent Google AdSense wrapper (#adsense-mobile-top / #adsense-desktop-left/right)
 * wraps #reader-root's mount child once without wiping live ad iframes on episode switches.
 */
export function ensureReaderContentMount(mode: ReaderMode): HTMLElement | null {
  if (typeof document === 'undefined') return null;
  const root = document.getElementById('reader-root');
  if (!root) return null;

  let mount = document.getElementById('reader-content-host');
  if (!mount) {
    const adRemoved = isAdRemoved();
    const desktopWide = isDesktopWideLandscape();
    const topBarHtml = adRemoved
      ? ''
      : `
      <div style="display:${desktopWide ? 'none' : 'block'};height:52px;min-height:52px;max-height:52px;" class="w-full shrink-0 overflow-hidden">
        <div id="adsense-mobile-top" data-nosnippet="" style="display:${desktopWide ? 'none' : 'block'};height:52px;min-height:52px;max-height:52px;isolation:isolate;" class="adsense-banner-top relative z-0 w-full shrink-0 select-none overflow-hidden border-b border-[#c8a158]/25 bg-[#100a06] px-1 text-center" aria-label="Google AdSense Top Banner">
          <div class="adsense-banner-inner relative mx-auto flex h-[50px] max-w-[360px] items-center justify-center gap-1.5 overflow-hidden">
            <span class="shrink-0 rounded border border-amber-500/35 bg-black/70 px-1 py-0.5 text-[8px] font-extrabold tracking-wider text-amber-200/75 uppercase">AD</span>
            <div class="adsense-slot-wrapper relative flex h-[50px] max-h-[50px] min-h-[50px] flex-1 items-center justify-center overflow-hidden"></div>
          </div>
        </div>
      </div>`;

    const leftGutterHtml = adRemoved
      ? ''
      : `
      <aside id="adsense-desktop-left" data-nosnippet="" style="display:${desktopWide ? 'flex' : 'none'};isolation:isolate;" class="adsense-gutter adsense-desktop-left relative z-0 w-[176px] shrink-0 select-none flex-col items-center justify-start border-r border-[#c8a158]/20 bg-[#0c0805] px-2 py-4 text-center" aria-label="Google AdSense Left Wing">
        <div class="sticky top-4 w-[160px] overflow-hidden rounded-xl border border-[#c8a158]/25 bg-black/50 p-1.5">
          <div class="mb-1 flex items-center justify-between border-b border-amber-500/20 pb-1 text-[9px] font-bold tracking-wider text-amber-200/65 uppercase">
            <span>AD</span><span>Google Ads</span>
          </div>
          <div class="adsense-slot-wrapper relative flex min-h-[600px] w-full items-center justify-center overflow-hidden"></div>
        </div>
      </aside>`;

    const rightGutterHtml = adRemoved
      ? ''
      : `
      <aside id="adsense-desktop-right" data-nosnippet="" style="display:${desktopWide ? 'flex' : 'none'};isolation:isolate;" class="adsense-gutter adsense-desktop-right relative z-0 w-[176px] shrink-0 select-none flex-col items-center justify-start border-l border-[#c8a158]/20 bg-[#0c0805] px-2 py-4 text-center" aria-label="Google AdSense Right Wing">
        <div class="sticky top-4 w-[160px] overflow-hidden rounded-xl border border-[#c8a158]/25 bg-black/50 p-1.5">
          <div class="mb-1 flex items-center justify-between border-b border-amber-500/20 pb-1 text-[9px] font-bold tracking-wider text-amber-200/65 uppercase">
            <span>AD</span><span>Google Ads</span>
          </div>
          <div class="adsense-slot-wrapper relative flex min-h-[600px] w-full items-center justify-center overflow-hidden"></div>
        </div>
      </aside>`;

    root.innerHTML = `
      <div class="flex min-h-screen w-full flex-col bg-[#120b06] text-[#f8ebd2]">
        ${topBarHtml}
        <div class="flex min-w-0 flex-1 flex-row items-stretch">
          ${leftGutterHtml}
          <div id="reader-content-host" class="min-w-0 flex-1"></div>
          ${rightGutterHtml}
        </div>
      </div>
    `;
    mount = document.getElementById('reader-content-host');
  }

  if (readerShellBoundMode !== mode) {
    readerShellBoundMode = mode;
    initAdSenseContainmentObserver();
    syncAdSenseRatioLayout(mode);
    pushAdSenseTags(mode);
    window.addEventListener('resize', () => syncAdSenseRatioLayout(mode));
    window.addEventListener('orientationchange', () => syncAdSenseRatioLayout(mode));
  }

  if (mount) {
    protectLinksFromVignette(mount);
  }
  return mount;
}
