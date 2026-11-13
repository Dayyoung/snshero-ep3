import './styles.css';
import { setLanguage, SupportedLanguage } from './i18n';
import { renderReaderHeader, renderReaderFooter, toggleReaderMobileMenu, closeReaderMobileMenu } from './ReaderChrome';
import { renderBookSection, handleBookAction } from './BookSection';

function renderApp(): void {
  const root = document.getElementById('reader-root');
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

  if (action.startsWith('book-')) {
    handleBookAction(action, el);
    renderApp();
  }
});

document.addEventListener('change', (event) => {
  const el = event.target as HTMLElement | null;
  if (!el) return;
  const action = el.getAttribute('data-action');
  if (action && action.startsWith('book-')) {
    handleBookAction(action, el);
    renderApp();
  }
});

renderApp();
