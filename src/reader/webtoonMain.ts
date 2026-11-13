import './styles.css';
import { setLanguage, SupportedLanguage } from './i18n';
import { renderReaderHeader, renderReaderFooter, toggleReaderMobileMenu, closeReaderMobileMenu } from './ReaderChrome';
import {
  renderWebtoonSection,
  handleWebtoonAction,
  isWebtoonLightboxOpen,
  closeWebtoonLightbox,
} from './WebtoonSection';

function renderApp(): void {
  const root = document.getElementById('reader-root');
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
  if (!isWebtoonLightboxOpen()) return;
  if (event.key === 'Escape') {
    closeWebtoonLightbox();
    renderApp();
  } else if (event.key === 'ArrowLeft') {
    handleWebtoonAction('webtoon-lightbox-prev');
    renderApp();
  } else if (event.key === 'ArrowRight') {
    handleWebtoonAction('webtoon-lightbox-next');
    renderApp();
  }
});

renderApp();
