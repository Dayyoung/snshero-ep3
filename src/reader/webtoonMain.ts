import './styles.css';
import { getCurrentLanguage, setLanguage, SupportedLanguage, tr } from './i18n';
import { renderReaderHeader, renderReaderFooter, toggleReaderMobileMenu, closeReaderMobileMenu, ensureReaderContentMount } from './ReaderChrome';
import {
  renderWebtoonSection,
  handleWebtoonAction,
  isWebtoonLightboxOpen,
  closeWebtoonLightbox,
} from './WebtoonSection';

function renderApp(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getCurrentLanguage();
    document.title = tr(
      '눈히어로 공식 웹툰 — 카단의 여정 (40부작) | SNSHero.com',
      "SNSHero Official Webtoon — Kadan's Journey (40 Episodes) | SNSHero.com"
    );
  }
  const root = ensureReaderContentMount('webtoon');
  if (!root) return;
  root.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#120b06] text-[#f8ebd2]">
      ${renderReaderHeader('webtoon')}
      <div class="flex-1 w-full">
        ${renderWebtoonSection()}
      </div>
      ${renderReaderFooter()}
    </div>
  `;
}

document.addEventListener('click', (event) => {
  const el = (event.target as HTMLElement | null)?.closest<HTMLElement>('[data-action]');
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (!action) return;

  if (action === 'reader-set-lang') {
    const lang = el.getAttribute('data-lang') as SupportedLanguage | null;
    if (lang) {
      setLanguage(lang);
      renderApp();
    }
    return;
  }

  if (action === 'reader-toggle-menu') {
    toggleReaderMobileMenu();
    renderApp();
    return;
  }

  if (action === 'reader-close-menu') {
    closeReaderMobileMenu();
    return;
  }

  if (action.startsWith('webtoon-')) {
    handleWebtoonAction(action, el);
    renderApp();
  }
});

document.addEventListener('change', (event) => {
  const el = event.target as HTMLElement | null;
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (action && action.startsWith('webtoon-')) {
    handleWebtoonAction(action, el);
    renderApp();
  }
});

document.addEventListener('keydown', (event) => {
  if (isWebtoonLightboxOpen()) {
    if (event.key === 'Escape') {
      event.preventDefault();
      closeWebtoonLightbox();
      renderApp();
    } else if (event.key === 'ArrowLeft') {
      event.preventDefault();
      handleWebtoonAction('webtoon-lightbox-prev');
      renderApp();
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      handleWebtoonAction('webtoon-lightbox-next');
      renderApp();
    }
    return;
  }
  const tag = (event.target as HTMLElement | null)?.tagName;
  if (tag === 'INPUT' || tag === 'SELECT' || tag === 'TEXTAREA') return;
  if (event.key === 'ArrowLeft') {
    event.preventDefault();
    handleWebtoonAction('webtoon-prev-episode');
    renderApp();
  } else if (event.key === 'ArrowRight') {
    event.preventDefault();
    handleWebtoonAction('webtoon-next-episode');
    renderApp();
  }
});

renderApp();
