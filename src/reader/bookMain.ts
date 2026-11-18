import './styles.css';
import episodesSchema from '../content/episodes.json';
import { getCurrentLanguage, setLanguage, SupportedLanguage, tr } from './i18n';
import { renderReaderHeader, renderReaderFooter, toggleReaderMobileMenu, closeReaderMobileMenu, ensureReaderContentMount } from './ReaderChrome';
import {
  renderBookSection,
  handleBookAction,
  isBookIndexOpen,
  closeBookIndex,
  getBookEpisode,
  initBookEpisodeFromUrl,
} from './BookSection';

initBookEpisodeFromUrl();

function renderApp(): void {
  if (typeof document !== 'undefined') {
    document.documentElement.lang = getCurrentLanguage();
    const ep = getBookEpisode();
    const epMeta = episodesSchema.find((x) => x.ep === ep);
    const hasExplicitEp =
      /\/(?:book|novel)\/ep-\d+/i.test(window.location.pathname) ||
      /[?&]ep=\d+/.test(window.location.search);
    if (epMeta && (hasExplicitEp || ep > 1)) {
      document.title = tr(
        `제${ep}화 ${epMeta.titleKo} — 눈히어로 공식 웹소설 카단의 여정 | SNSHero.com`,
        `Episode ${ep}: ${epMeta.titleEn} — SNSHero Official Web Novel | SNSHero.com`,
      );
    } else {
      document.title = tr(
        '눈히어로 공식 웹소설 — 카단의 여정 (40부작) | SNSHero.com',
        "SNSHero Official Web Novel — Kadan's Journey (40 Episodes) | SNSHero.com",
      );
    }
  }
  const root = ensureReaderContentMount('book');
  if (!root) return;
  root.innerHTML = `
    <div class="min-h-screen flex flex-col bg-[#120b06] text-[#f8ebd2]">
      ${renderReaderHeader('book')}
      <div class="flex-1 w-full">
        ${renderBookSection()}
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
      document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isBookIndexOpen()) {
    closeBookIndex();
    renderApp();
  }
});

renderApp();
    }
    return;
  }

  if (action === 'reader-toggle-menu') {
    toggleReaderMobileMenu();
    document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isBookIndexOpen()) {
    closeBookIndex();
    renderApp();
  }
});

renderApp();
    return;
  }

  if (action === 'reader-close-menu') {
    closeReaderMobileMenu();
    return;
  }

  if (action.startsWith('book-')) {
    handleBookAction(action, el);
    document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isBookIndexOpen()) {
    closeBookIndex();
    renderApp();
  }
});

renderApp();
  }
});

document.addEventListener('change', (event) => {
  const el = event.target as HTMLElement | null;
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (action && action.startsWith('book-')) {
    handleBookAction(action, el);
    document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isBookIndexOpen()) {
    closeBookIndex();
    renderApp();
  }
});

renderApp();
  }
});

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && isBookIndexOpen()) {
    closeBookIndex();
    renderApp();
  }
});

renderApp();
