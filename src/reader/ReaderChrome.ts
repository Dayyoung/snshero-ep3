import { getCurrentLanguage, SupportedLanguage, tr } from './i18n';

export type ReaderMode = 'book' | 'webtoon';

export function renderReaderHeader(mode: ReaderMode): string {
  const lang = getCurrentLanguage();
  const links: { href: string; label: string; active: boolean }[] = [
    { href: '/', label: tr('게임 시작', 'Play Game', 'ゲーム開始'), active: false },
    { href: '/promo.html', label: tr('게임 소개', 'Intro', '紹介'), active: false },
    { href: '/book.html', label: tr('웹소설', 'Novel', '小説'), active: mode === 'book' },
    { href: '/webtoon.html', label: tr('웹툰', 'Webtoon', 'ウェブトゥーン'), active: mode === 'webtoon' },
    { href: '/stone.html', label: tr('오리지널', 'Classic', 'クラシック'), active: false },
  ];

  const langBtn = (code: SupportedLanguage, text: string) => {
    const active = lang === code;
    return `<button type="button" data-action="reader-set-lang" data-lang="${code}" class="px-2.5 py-1 text-[11px] font-bold rounded-sm min-h-[36px] cursor-pointer transition-colors ${
      active
        ? 'bg-[#201d1d] text-[#fdfcfc]'
        : 'bg-[#f8f7f7] text-[#646262] hover:bg-[#edeaea] border border-[rgba(15,0,0,0.12)]'
    }">${text}</button>`;
  };

  return `
    <header class="w-full bg-[#fdfcfc] border-b border-[rgba(15,0,0,0.12)] font-mono">
      <div class="w-full max-w-5xl mx-auto px-4 py-3 sm:px-6 flex flex-wrap items-center justify-between gap-3">
        <div class="flex items-center gap-2.5">
          <a href="/" class="flex items-center gap-2 text-[#201d1d] no-underline hover:opacity-80">
            <img src="/icon.png" alt="SNSHero" class="w-7 h-7 rounded-sm border border-[rgba(15,0,0,0.16)]" />
            <span class="text-sm font-black tracking-tight">SNSHero</span>
          </a>
          <span class="text-[rgba(15,0,0,0.2)]">/</span>
          <span class="px-2 py-0.5 bg-[#201d1d] text-[#fdfcfc] text-[10px] font-bold rounded-sm tracking-wider uppercase">
            ${mode === 'book' ? tr('공식 웹소설 40부작', 'Official Web Novel', '公式ウェブ小説') : tr('공식 웹툰 40부작', 'Official Webtoon', '公式ウェブトゥーン')}
          </span>
        </div>

        <nav class="flex flex-wrap items-center gap-1.5" aria-label="Primary Reader Navigation">
          ${links
            .map(
              (item) => `<a href="${item.href}" class="px-3 py-1.5 text-xs font-bold rounded-sm min-h-[40px] flex items-center justify-center no-underline transition-colors ${
                item.active
                  ? 'bg-[#201d1d] text-[#fdfcfc]'
                  : 'bg-[#f8f7f7] text-[#201d1d] hover:bg-[#edeaea] border border-[rgba(15,0,0,0.12)]'
              }">${item.label}</a>`,
            )
            .join('')}
          <div class="flex items-center gap-1 ml-1">
            ${langBtn('ko', 'KO')}
            ${langBtn('en', 'EN')}
          </div>
        </nav>
      </div>
    </header>
  `;
}

export function renderReaderFooter(): string {
  return `
    <footer class="w-full bg-[#f8f7f7] border-t border-[rgba(15,0,0,0.12)] font-mono text-[#646262] mt-auto">
      <div class="w-full max-w-5xl mx-auto px-4 py-6 sm:px-6 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
        <span class="font-bold text-[#201d1d]">눈히어로 (SNSHero.com) · 카단의 여정 40부작</span>
        <div class="flex flex-wrap items-center gap-3">
          <a href="/" class="hover:text-[#201d1d] underline">${tr('게임 실행 (/)', 'Play Game (/)', 'ゲーム実行')}</a>
          <a href="/promo.html" class="hover:text-[#201d1d] underline">${tr('게임 소개', 'Promo', '紹介')}</a>
          <a href="/book.html" class="hover:text-[#201d1d] underline">${tr('웹소설', 'Novel', '小説')}</a>
          <a href="/webtoon.html" class="hover:text-[#201d1d] underline">${tr('웹툰', 'Webtoon', 'ウェブトゥーン')}</a>
          <a href="/stone.html" class="hover:text-[#201d1d] underline">${tr('오리지널 스톤', 'Classic Stone', 'クラシック')}</a>
        </div>
      </div>
    </footer>
  `;
}
