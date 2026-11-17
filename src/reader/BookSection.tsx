/**
 * src/landing/views/BookSection.tsx
 *
 * Official 40-Episode Web Novel Reader View for SNSHero Static Landing (#book).
 * Strictly complies with DESIGN.md OpenCode Terminal-Flat design:
 *   - Monospace typography (font-mono)
 *   - Flat surfaces (#fdfcfc, #201d1d) with 1px hairline borders
 *   - 0px container radii (rounded-none), max 4px button/badge radii (rounded-sm)
 *   - 44px+ minimum touch targets for all interactive controls
 *
 * Renders the unabridged canonical text from public/novel-assets/episode_*.md.
 * Features:
 *   - Episode switcher (<select>, Prev/Next buttons, and full 40-episode index accordion drawer)
 *   - Clean, immersive reading layout without distracting UI clutter
 *   - Font size adjustment (A-, A+)
 *   - Hash query (?ep=N) synchronization
 */

import { EXTERNAL_LINKS } from './types';
import { getEpisodeBridgeInfo, getActLabel } from './episodeBridge';
import { getNovelRawEpisode } from '../content/novelRawEpisodes';
import { getNovelRawEpisodeEn } from '../content/novelRawEpisodesEn';
import episodesSchema from '../content/episodes.json';
import { isKoreanLanguage, tr } from './i18n';
import { getMediaReadProgressSummary, recordMediaEpisodeRead } from '../hearthstone/storage';

const EPISODES_SSOT: { ep: number; titleKo: string; titleEn: string }[] = episodesSchema;

export function isBookIndexOpen(): boolean {
  return isEpisodeListOpen;
}

export function closeBookIndex(): void {
  isEpisodeListOpen = false;
}

let currentBookEpisode: number = 1;
let isEpisodeListOpen: boolean = false;
let selectedTocAct: 0 | 1 | 2 | 3 | 4 = 0;
let isVoicePreviewOpen: boolean = false;
let isBossStatsOpen: boolean = false;
let bookFontSize: 'normal' | 'large' | 'xlarge' = 'normal';

export function getBookEpisode(): number {
  return currentBookEpisode;
}

function scrollToTopPage(): void {
  if (typeof window === 'undefined') return;
  window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  document.documentElement.scrollTop = 0;
  document.body.scrollTop = 0;
  requestAnimationFrame(() => {
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
    document.documentElement.scrollTop = 0;
    document.body.scrollTop = 0;
  });
}

export function setBookEpisode(ep: number, updateUrl: boolean = true): void {
  if (typeof ep !== 'number' || isNaN(ep)) ep = 1;
  currentBookEpisode = Math.max(1, Math.min(40, Math.floor(ep)));
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('hero_hs_last_novel_ep', String(currentBookEpisode));
      localStorage.setItem('snshero_last_novel_ep', String(currentBookEpisode));
    } catch {
      // Ignore storage quota errors
    }
  }

  if (updateUrl && typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('ep', String(currentBookEpisode));
      window.history.replaceState({ view: 'book', ep: currentBookEpisode }, '', url.toString());
    } catch {
      // Ignore if URL replacement fails in sandbox
    }
    scrollToTopPage();
  }
}

let savedResumeEpisodeNotice: number | null = null;

export function initBookEpisodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  const searchMatch = (window.location.search || '').match(/[?&]ep=(\d+)/);
  const hashMatch = (window.location.hash || '').match(/ep=(\d+)/);
  const match = searchMatch || hashMatch;
  if (match && match[1]) {
    const epNum = parseInt(match[1], 10);
    if (!isNaN(epNum) && epNum >= 1 && epNum <= 40) {
      currentBookEpisode = epNum;
    }
  } else if (typeof localStorage !== 'undefined') {
    try {
      const lastReadRaw =
        localStorage.getItem('snshero_last_novel_ep') ||
        localStorage.getItem('hero_hs_last_novel_ep');
      const lastReadEp = lastReadRaw ? parseInt(lastReadRaw, 10) : 0;
      if (!isNaN(lastReadEp) && lastReadEp >= 2 && lastReadEp <= 40) {
        currentBookEpisode = lastReadEp;
        savedResumeEpisodeNotice = lastReadEp;
      } else {
        const profileRaw = localStorage.getItem('hero_hs_profile');
        if (profileRaw) {
          const parsed = JSON.parse(profileRaw) as { journeyMaxStageCleared?: number };
          const cleared = parsed?.journeyMaxStageCleared || 0;
          if (cleared > 0) {
            currentBookEpisode = Math.max(1, Math.min(40, cleared + 1));
          }
        }
      }
    } catch {
      // ignore storage parse error
    }
  }
  if (typeof localStorage !== 'undefined') {
    try {
      localStorage.setItem('hero_hs_last_novel_ep', String(currentBookEpisode));
      localStorage.setItem('snshero_last_novel_ep', String(currentBookEpisode));
    } catch {
      // ignore storage quota error
    }
  }
}

export function handleBookAction(action: string, target?: HTMLElement): void {
  if (action === 'book-prev-episode') {
    if (currentBookEpisode > 1) {
      setBookEpisode(currentBookEpisode - 1);
    }
  } else if (action === 'book-next-episode') {
    if (currentBookEpisode < 40) {
      setBookEpisode(currentBookEpisode + 1);
    }
  } else if (action === 'book-jump-episode') {
    const epAttr = target?.getAttribute('data-episode');
    if (epAttr) {
      const epNum = parseInt(epAttr, 10);
      if (!isNaN(epNum)) {
        setBookEpisode(epNum);
        isEpisodeListOpen = false;
      }
    }
  } else if (action === 'book-select-episode') {
    const select = target as HTMLSelectElement | null;
    if (select && select.value) {
      const val = parseInt(select.value, 10);
      if (!isNaN(val)) setBookEpisode(val);
    }
  } else if (action === 'book-toggle-index') {
    isEpisodeListOpen = !isEpisodeListOpen;
  } else if (action === 'book-close-index') {
    isEpisodeListOpen = false;
  } else if (action === 'book-select-toc-act') {
    const actAttr = Number(target?.getAttribute('data-act') || '0');
    if (actAttr >= 0 && actAttr <= 4) {
      selectedTocAct = actAttr as 0 | 1 | 2 | 3 | 4;
    }
  } else if (action === 'book-toggle-voice') {
    isVoicePreviewOpen = !isVoicePreviewOpen;
  } else if (action === 'book-toggle-boss') {
    isBossStatsOpen = !isBossStatsOpen;
  } else if (action === 'book-font-normal') {
    bookFontSize = 'normal';
  } else if (action === 'book-font-large') {
    bookFontSize = 'large';
  } else if (action === 'book-font-xlarge') {
    bookFontSize = 'xlarge';
  } else if (action === 'book-scroll-top') {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

/**
 * Parses raw markdown novel text into structured sections:
 * Title, Scope citation, and paragraphs/dialogues.
 */
interface ParsedNovel {
  mainTitle: string;
  sourceScope: string;
  paragraphs: string[];
}

function parseRawNovel(rawText: string, fallbackEp: number): ParsedNovel {
  const isKo = isKoreanLanguage();
  if (!rawText || !rawText.trim()) {
    return {
      mainTitle: isKo
        ? `눈히어로.com - 카단의 여정 제 ${fallbackEp}화`
        : `SNSHero.com - Kadan's Journey Episode ${fallbackEp}`,
      sourceScope: '',
      paragraphs: [
        tr(
          '소설 본문을 불러오는 중입니다...',
          'Loading novel episode text...',
          '小説の本文を読み込んでいます...'
        ),
      ],
    };
  }

  const lines = rawText.split('\n');
  let mainTitle = '';
  let sourceScope = '';
  const bodyLines: string[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!mainTitle && line.startsWith('# ')) {
      mainTitle = line.replace(/^#\s*/, '').trim();
    } else if (!sourceScope && line.startsWith('> ')) {
      sourceScope = line.replace(/^>\s*/, '').trim();
    } else {
      bodyLines.push(lines[i]);
    }
  }

  // Join and split by double newlines to form pure paragraphs
  const rawParagraphs = bodyLines.join('\n').split(/\n\s*\n/);
  const cleanParagraphs: string[] = [];

  for (const para of rawParagraphs) {
    const trimmed = para.trim();
    if (!trimmed) continue;
    // Strip trailing promotion or delimiter blocks if present
    if (
      trimmed.startsWith('==') ||
      trimmed.includes('소설 관련 카드게임 플레이를 원하시나요') ||
      trimmed.includes('Want to play the card game based on the novel')
    ) {
      continue;
    }
    cleanParagraphs.push(trimmed);
  }

  if (!mainTitle) {
    mainTitle = isKo
      ? `눈히어로.com - 카단의 여정 제 ${fallbackEp}화`
      : `SNSHero.com - Kadan's Journey Episode ${fallbackEp}`;
  }

  return {
    mainTitle,
    sourceScope,
    paragraphs: cleanParagraphs,
  };
}

export function renderBookSection(): string {
  initBookEpisodeFromUrl();

  const ep = currentBookEpisode;
  const isKo = isKoreanLanguage();
  const bridge = getEpisodeBridgeInfo(ep);
  const rawContent = isKo ? getNovelRawEpisode(ep) : getNovelRawEpisodeEn(ep) || getNovelRawEpisode(ep);
  const parsed = parseRawNovel(rawContent, ep);
  const epTitle = isKo
    ? EPISODES_SSOT[ep - 1]?.titleKo || `제 ${ep}화`
    : EPISODES_SSOT[ep - 1]?.titleEn || `Episode ${ep}`;
  const canonicalH1 = isKo
    ? `눈히어로.com - 카단의 여정 ${ep}화 - ${epTitle}`
    : `SNSHero.com - Kadan's Journey Episode ${ep}: ${epTitle}`;

  const fontClass =
    bookFontSize === 'xlarge'
      ? 'text-[18px] sm:text-[21px] leading-[2.3]'
      : bookFontSize === 'large'
      ? 'text-[16px] sm:text-[19px] leading-[2.1]'
      : 'text-[15px] sm:text-[17px] leading-[1.9]';

  return `
    <div class="w-full flex flex-col text-[#f8ebd2] select-none bg-[#120b06]">
      <!-- 1. Tavern Wood Sub-Navigation Bar -->
      <section class="w-full bg-[#1b1008]/95 border-b border-amber-700/40 backdrop-blur-md sticky top-16 sm:top-[70px] z-30 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
        <div class="w-full max-w-5xl mx-auto px-4 py-3 sm:px-6">
          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <!-- Left: Title & Episode Badge -->
            <div class="flex items-center gap-2.5">
              <span class="px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold rounded-full tracking-wider uppercase">
                EP.${String(ep).padStart(2, '0')}
              </span>
              <span class="text-xs sm:text-sm font-extrabold text-amber-100 truncate max-w-[200px] sm:max-w-md hs-outline-sm">
                ${epTitle}
              </span>
            </div>

            <!-- Right: Font Sizing & Index Drawer Toggle -->
            <div class="flex items-center gap-2">
              <!-- Font Size Buttons -->
              <div class="flex items-center border border-amber-600/40 rounded-full overflow-hidden bg-black/40 p-0.5">
                <button
                  type="button"
                  data-action="book-font-normal"
                  class="px-2.5 py-1 text-xs font-extrabold rounded-full transition ${bookFontSize === 'normal' ? 'bg-amber-400 text-[#1b120b]' : 'text-amber-200/80 hover:text-amber-100'} cursor-pointer"
                  title="${tr('보통 글자', 'Normal Font', '標準文字')}"
                >
                  ${tr('기본', 'A', '標準')}
                </button>
                <button
                  type="button"
                  data-action="book-font-large"
                  class="px-2.5 py-1 text-xs font-extrabold rounded-full transition ${bookFontSize === 'large' ? 'bg-amber-400 text-[#1b120b]' : 'text-amber-200/80 hover:text-amber-100'} cursor-pointer"
                  title="${tr('큰 글자', 'Large Font', '大きく')}"
                >
                  ${tr('크게', 'A+', '大')}
                </button>
                <button
                  type="button"
                  data-action="book-font-xlarge"
                  class="px-2.5 py-1 text-xs font-extrabold rounded-full transition ${bookFontSize === 'xlarge' ? 'bg-amber-400 text-[#1b120b]' : 'text-amber-200/80 hover:text-amber-100'} cursor-pointer"
                  title="${tr('아주 큰 글자', 'Extra Large Font', '特大')}"
                >
                  ${tr('더크게', 'A++', '特大')}
                </button>
              </div>

              <button
                type="button"
                data-action="book-toggle-voice"
                class="px-3 py-1.5 bg-sky-950/70 text-sky-200 hover:bg-sky-900/90 border border-sky-400/40 text-xs font-extrabold rounded-full min-h-[36px] flex items-center gap-1 cursor-pointer transition"
              >
                <span>🔊 ${tr('성우 보이스', 'Voice')}</span>
              </button>

              <button
                type="button"
                data-action="book-toggle-boss"
                class="px-3 py-1.5 bg-rose-950/70 text-rose-200 hover:bg-rose-900/90 border border-rose-400/40 text-xs font-extrabold rounded-full min-h-[36px] flex items-center gap-1 cursor-pointer transition"
              >
                <span>⚔ ${tr('등장 보스', 'Boss')}</span>
              </button>

              <!-- Full Episode List Toggle -->
              <button
                type="button"
                data-action="book-toggle-index"
                class="px-3.5 py-1.5 bg-amber-950/60 text-amber-200 hover:bg-amber-900/80 border border-amber-500/40 text-xs font-extrabold rounded-full min-h-[36px] flex items-center gap-1 cursor-pointer transition"
                title="${tr('전체 40화 목차 보기', 'View All 40 Episodes', '全40話の目次を表示')}"
              >
                <span>${isEpisodeListOpen ? tr('목차 닫기 ▲', 'Close Index ▲', '目次を閉じる ▲') : tr('전체 목차 ▼', 'All Episodes ▼', '全話目次 ▼')}</span>
              </button>
            </div>
          </div>

          <!-- Quick Episode Controls Bar -->
          ${
            savedResumeEpisodeNotice && savedResumeEpisodeNotice === ep
              ? `<div data-testid="book-resume-banner" class="mt-2 rounded-xl border border-emerald-400/45 bg-emerald-950/60 px-3 py-1.5 text-center text-[11px] font-extrabold text-emerald-200">
                  📖 ${tr(`마지막 읽던 제${ep}화 이어읽기로 자동 복원되었습니다.`, `Resumed from your last read Chapter (EP.${ep}).`)}
                </div>`
              : ''
          }
          <div class="flex items-center justify-between gap-2 pt-3 border-t border-amber-700/30 mt-2.5">
            <!-- Prev Episode Button -->
            <button
              type="button"
              data-action="book-prev-episode"
              ${ep <= 1 ? 'disabled' : ''}
              class="px-3.5 py-2 bg-[#2a180c] text-amber-100 hover:bg-[#3a2211] border border-amber-500/40 disabled:opacity-30 text-xs font-extrabold rounded-full min-h-[42px] flex items-center gap-1 cursor-pointer transition"
              aria-label="${tr('이전 화', 'Previous Episode', '前の話')}"
            >
              ◀ ${tr('이전화', 'Prev', '前話')}
            </button>

            <!-- Dropdown Episode Selector -->
            <div class="flex items-center gap-1.5 flex-1 max-w-xs mx-auto">
              <select
                id="book-episode-select"
                data-action="book-select-episode"
                class="w-full px-3 py-2 bg-[#120b06] text-[#f8ebd2] border border-amber-600/50 text-xs font-extrabold rounded-full min-h-[42px] cursor-pointer focus:outline-none focus:border-amber-400 text-center"
              >
                ${Array.from({ length: 40 }, (_, idx) => {
                  const num = idx + 1;
                  const title = isKo
                    ? EPISODES_SSOT[idx]?.titleKo || `제 ${num}화`
                    : EPISODES_SSOT[idx]?.titleEn || `Episode ${num}`;
                  const epPrefix = isKo ? `제${num}화` : `EP.${String(num).padStart(2, '0')}`;
                  return `
                    <option value="${num}" ${num === ep ? 'selected' : ''}>
                      ${epPrefix} - ${title}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <!-- Next Episode Button -->
            <button
              type="button"
              data-action="book-next-episode"
              ${ep >= 40 ? 'disabled' : ''}
              class="hs-promo-cta-purple px-4 py-2 disabled:opacity-30 text-xs font-extrabold rounded-full min-h-[42px] flex items-center gap-1 cursor-pointer"
              aria-label="${tr('다음 화', 'Next Episode', '次の話')}"
            >
              ${tr('다음화', 'Next', '次話')} ▶
            </button>
          </div>
        </div>

        <!-- 40-Episode TOC Modal with Backdrop & ESC Dismiss (BLD-2709) -->
        ${
          isEpisodeListOpen
            ? `
          <div
            data-testid="book-toc-backdrop"
            data-action="book-close-index"
            class="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-3 sm:p-6 backdrop-blur-sm"
          >
            <div
              data-action="book-toc-panel"
              class="w-full max-w-4xl rounded-2xl border-2 border-[#c8a158]/80 bg-[#140c06] p-4 sm:p-6 shadow-2xl max-h-[85dvh] flex flex-col"
            >
              <div class="flex items-center justify-between pb-2 mb-3 border-b border-amber-700/30">
                <span class="text-xs sm:text-sm font-extrabold text-amber-200">
                  ${tr(
                    '카단의 여정 40화 전편 목차 (원하는 화를 클릭하면 즉시 이동합니다)',
                    "Kadan's Journey — All 40 Episodes Index (Click any episode to jump)",
                    'カダンの旅 全40話目次（クリックで該当エピソードへ移動）'
                  )}
                </span>
                <button
                  type="button"
                  data-testid="book-toc-close-btn"
                  data-action="book-close-index"
                  class="text-xs text-amber-300/80 hover:text-amber-100 font-extrabold px-2.5 py-1.5 rounded-lg border border-amber-700/40 bg-black/40 cursor-pointer"
                >
                  [${tr('닫기', 'Close', '閉じる')} ✕]
                </button>
              </div>
              <div class="flex flex-wrap gap-1.5 mb-3">
                ${([0, 1, 2, 3, 4] as const)
                  .map(
                    (act) => `
                    <button
                      type="button"
                      data-action="book-select-toc-act"
                      data-act="${act}"
                      class="px-3 py-1.5 rounded-full text-[11px] font-extrabold border cursor-pointer transition ${
                        selectedTocAct === act
                          ? 'bg-amber-500 text-[#1b0f05] border-amber-300'
                          : 'bg-[#1f1209] text-amber-200/80 border-amber-700/40 hover:border-amber-400'
                      }"
                    >
                      ${getActLabel(act)}
                    </button>
                  `,
                  )
                  .join('')}
              </div>
              <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 overflow-y-auto pr-1 flex-1">
                ${Array.from({ length: 40 }, (_, idx) => idx + 1)
                  .filter((num) => {
                    if (selectedTocAct === 0) return true;
                    const actStart = (selectedTocAct - 1) * 10 + 1;
                    const actEnd = selectedTocAct * 10;
                    return num >= actStart && num <= actEnd;
                  })
                  .map((num) => {
                    const idx = num - 1;
                    const title = isKo
                      ? EPISODES_SSOT[idx]?.titleKo || `제 ${num}화`
                      : EPISODES_SSOT[idx]?.titleEn || `Episode ${num}`;
                    const isCurrent = num === ep;
                    const epBadge = isKo ? `[${num}화]` : `[EP.${String(num).padStart(2, '0')}]`;
                    return `
                    <button
                      type="button"
                      data-action="book-jump-episode"
                      data-episode="${num}"
                      class="px-2.5 py-2 text-left text-xs rounded-lg border transition truncate min-h-[40px] cursor-pointer ${
                        isCurrent
                          ? 'bg-amber-500/25 text-amber-200 border-amber-400 font-extrabold'
                          : 'bg-[#1f1209] text-amber-100/80 border-amber-800/40 hover:border-amber-500/60 hover:bg-[#2a180c]'
                      }"
                      title="${epBadge} ${title}"
                    >
                      <span class="font-extrabold text-amber-300 mr-1">${epBadge}</span>
                      <span class="truncate">${title}</span>
                    </button>
                  `;
                  })
                  .join('')}
              </div>
              ${
                selectedTocAct > 0
                  ? `
                <div class="mt-3 pt-2.5 border-t border-amber-700/30 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span class="font-extrabold text-amber-200">
                    ⚔ ${tr(`제${selectedTocAct}막 최종 보스 (${selectedTocAct * 10}화) 인게임 직접 도전`, `Battle Act ${selectedTocAct} Final Boss (EP.${selectedTocAct * 10})`)}
                  </span>
                  <a
                    href="/game?mode=story&ep=${selectedTocAct * 10}&utm_source=book_toc_act"
                    class="hs-promo-cta-purple px-4 py-1.5 rounded-full text-[11px] font-extrabold no-underline"
                  >
                    ${tr(`제${selectedTocAct * 10}화 보스 레이드 →`, `Play EP.${selectedTocAct * 10} Boss →`)}
                  </a>
                </div>
              `
                  : ''
              }
            </div>
          </div>
        `
            : ''
        }

        ${
          isVoicePreviewOpen
            ? `
          <div class="w-full max-w-5xl mx-auto px-4 py-3 sm:px-6 bg-[#140c06] border-t border-sky-500/30">
            <div class="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div class="text-xs font-extrabold text-sky-200">
                🔊 ${tr(`제${ep}화 스튜디오 성우 풀보이스 미리듣기`, `EP.${ep} Studio Full-Voice Narration Preview`)}
              </div>
              <audio controls preload="none" src="${bridge.voiceAudioUrl}" class="w-full sm:max-w-md h-9"></audio>
            </div>
          </div>
        `
            : ''
        }

        ${
          isBossStatsOpen
            ? `
          <div class="w-full max-w-5xl mx-auto px-4 py-3 sm:px-6 bg-[#140c06] border-t border-rose-500/30">
            <div class="flex flex-wrap items-center justify-between gap-3">
              <div class="flex items-center gap-3">
                <img src="${bridge.bossImageUrl}" alt="${escapeHtml(isKo ? bridge.bossNameKo : bridge.bossNameEn)}" class="h-12 w-12 rounded-xl object-cover border border-rose-400/60 bg-black" />
                <div>
                  <div class="text-xs font-extrabold text-rose-300">
                    ${isKo ? bridge.bossNameKo : bridge.bossNameEn} · HP ${bridge.bossHp}
                  </div>
                  <div class="text-[11px] font-bold text-amber-200/80">
                    ${isKo ? bridge.bossRoleKo : bridge.bossRoleEn}
                  </div>
                </div>
              </div>
              <a
                href="/game?mode=story&ep=${ep}&utm_source=book_header_boss"
                class="hs-promo-cta-purple px-4 py-2 rounded-full text-xs font-extrabold no-underline"
              >
                ⚔ ${tr(`제${ep}화 보스전 직접 격파하기 (무료 3팩)`, `Challenge EP.${ep} Boss (3 Free Packs)`)}
              </a>
            </div>
          </div>
        `
            : ''
        }
      </section>

      <!-- 2. Parchment Novel Content Body (matches promo.html parchment theme) -->
      <main class="hs-promo-tavern w-full py-8 sm:py-12 px-3 sm:px-6 md:px-8">
        <article class="hs-promo-parchment hs-promo-gold-frame rounded-2xl w-full max-w-3xl mx-auto p-5 sm:p-10 md:p-12 space-y-8 select-text">
          
          <!-- Novel Title Header -->
          <header class="space-y-3 pb-6 border-b-2 border-[#b88a44]/40 text-center sm:text-left">
            <div class="flex flex-wrap items-center justify-center sm:justify-start gap-2">
              <span class="px-2.5 py-0.5 bg-[#2f1b0c] text-[#f8ebd2] text-[10px] font-extrabold rounded-full tracking-widest uppercase">
                CANONICAL NOVEL
              </span>
              <span class="text-xs font-extrabold text-amber-900">
                ${tr(`제 ${ep}화 / 총 40화 완결`, `Episode ${ep} / 40 Complete`, `第${ep}話 / 全40話完結`)}
              </span>
            </div>

            <h1 class="text-xl sm:text-2xl md:text-3xl font-extrabold text-[#2f1b0c] tracking-tight m-0 leading-snug">
              ${escapeHtml(canonicalH1)}
            </h1>

            ${
              parsed.sourceScope
                ? `
              <div class="inline-block px-3 py-1.5 bg-[#2f1b0c]/10 border-l-4 border-[#8b5a2b] text-xs font-bold text-[#4a2e16] rounded-r-md">
                ${parsed.sourceScope}
              </div>
            `
                : ''
            }
          </header>

          <!-- Novel Paragraphs (Warm Parchment Ink) -->
          <div class="space-y-6 sm:space-y-7 ${fontClass} text-[#2f1b0c] font-normal">
            ${parsed.paragraphs
              .map((para) => {
                const isDialogue =
                  para.startsWith('“') ||
                  para.startsWith('"') ||
                  para.startsWith('\'') ||
                  para.startsWith('‘') ||
                  para.startsWith('「');

                if (isDialogue) {
                  return `
                    <p class="m-0 font-bold text-[#1f1005] pl-3 sm:pl-4 border-l-4 border-amber-700/70 bg-amber-950/5 py-1.5 pr-2 rounded-r-lg">
                      ${escapeHtml(para)}
                    </p>
                  `;
                }

                return `
                  <p class="m-0 text-[#2f1b0c] text-justify">
                    ${escapeHtml(para)}
                  </p>
                `;
              })
              .join('')}
          </div>

          <!-- Episode Completion Endmark & In-Game Boss Bridge (MKT-010, MKT-016, MKT-022, MKT-028) -->
          <div class="pt-10 pb-4 text-center border-t-2 border-[#b88a44]/40 space-y-4">
            <div class="space-y-1">
              <span class="text-xs font-extrabold text-[#6e4621] tracking-widest uppercase">
                ${
                  ep === 40
                    ? tr(
                        '— 《카단의 여정》 제40화 대단원 완결 —',
                        "— End of Kadan's Journey Finale (EP.40) —",
                        '— 《カダンの旅》 第40話 大団円 完結 —',
                      )
                    : tr(
                        `— 《카단의 여정》 제 ${ep}화 끝 —`,
                        `— End of Kadan's Journey Episode ${ep} —`,
                        `— 《カダンの旅》 第${ep}話 完 —`,
                      )
                }
              </span>
              <p class="text-xs text-[#5c3c1e] font-bold m-0">
                ${
                  ep === 40
                    ? tr(
                        '카단의 여정 40부작 대단원이 완결되었습니다. 제1화부터 다시 정독하거나 웹툰·보스전에 도전해 보세요!',
                        'The 40-episode saga of Kadan is complete! Re-read from Episode 1 or challenge the final boss.',
                        'カダンの旅 全40話が完結しました！第1話から読み直すかボス戦に挑戦しましょう。',
                      )
                    : tr(
                        '다음 화에서 카단과 수호자들의 모험이 계속 이어집니다.',
                        'The adventure of Kadan and the Guardians continues in the next episode.',
                        '次話でもカダンと守護者たちの冒険が続きます。',
                      )
                }
              </p>
            </div>

            <div class="p-4 sm:p-5 rounded-2xl bg-[#1b1008] text-[#f8ebd2] border-2 border-[#c8a158]/70 text-left space-y-3 shadow-xl">
              <div class="flex flex-wrap items-center justify-between gap-2">
                <span class="px-2.5 py-0.5 rounded-full bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold">
                  ${
                    ep % 10 === 0
                      ? tr(`🔥 제${bridge.actNumber}막 완독 · 막 최종 보스전`, `🔥 Act ${bridge.actNumber} Finale Boss Raid`)
                      : ep % 5 === 0
                        ? tr('🎁 5화 돌파 보스팩 +1개 구간', '🎁 Milestone: +1 Boss Pack')
                        : tr(`⚔ 제${ep}화 보스 체험 브릿지`, `⚔ EP.${ep} Boss Bridge`)
                  }
                </span>
                <span data-testid="book-media-reward-badge" class="text-[11px] font-bold text-emerald-300">
                  ${(() => {
                    recordMediaEpisodeRead(ep);
                    const sum = getMediaReadProgressSummary();
                    return isKo
                      ? `🪙 회차 열람 +100G 성소 연동됨 (누적 ${sum.totalReadCount}/40화 · 10/40화 호칭 해금)`
                      : `🪙 +100G Seed Gold Synced (${sum.totalReadCount}/40 EPs · 10/40 Title Unlock)`;
                  })()}
                </span>
              </div>

              <!-- DEV-038: Simplified 1-Primary (Next Ep) + 1-Sub (Play Boss) Action Bar -->
              <div class="flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
                ${
                  ep < 40
                    ? `<button
                  type="button"
                  data-action="book-next-episode"
                  class="hs-promo-cta-purple flex-1 min-h-[48px] py-3 px-5 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 cursor-pointer"
                >
                  <span>📖 ${tr(`다음 화 읽기 (제${ep + 1}화) ▶`, `Read Next Episode (EP.${ep + 1}) ▶`)}</span>
                </button>`
                    : `<a
                  href="/webtoon?ep=${ep}"
                  class="hs-promo-cta-purple flex-1 min-h-[48px] py-3 px-5 rounded-full text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 no-underline"
                >
                  <span>🎨 ${tr('제40화 웹툰으로 감상하기 ▶', 'Read EP.40 Webtoon ▶')}</span>
                </a>`
                }
                <a
                  href="/game?mode=story&ep=${ep}&utm_source=book_card_widget"
                  class="min-h-[48px] px-5 py-3 rounded-full bg-[#2f1b0c] hover:bg-[#462913] border border-[#c8a158]/70 text-amber-200 text-xs sm:text-sm font-extrabold flex items-center justify-center gap-2 no-underline transition"
                >
                  <span>
                    ⚔ ${tr(`이번 화 보스전 체험`, `Try EP.${ep} Boss`)}
                  </span>
                </a>
              </div>
            </div>
          </div>

          <!-- Bottom Big Navigation Buttons -->
          <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pt-4 border-t border-[#b88a44]/35">
            <button
              type="button"
              data-action="book-prev-episode"
              ${ep <= 1 ? 'disabled' : ''}
              class="flex-1 py-3.5 px-4 bg-[#2f1b0c] text-[#f8ebd2] hover:bg-[#462913] border border-[#b88a44] disabled:opacity-30 text-xs sm:text-sm font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-2 cursor-pointer transition"
            >
              <span>◀ ${tr(`이전화 (제${Math.max(1, ep - 1)}화)`, `Prev (EP.${Math.max(1, ep - 1)})`, `前話 (第${Math.max(1, ep - 1)}話)`)}</span>
            </button>

            <button
              type="button"
              data-action="book-scroll-top"
              class="px-5 py-3.5 bg-[#f8ebd2]/70 text-[#2f1b0c] hover:bg-[#f8ebd2] border-2 border-[#8b5a2b]/60 text-xs font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-1 cursor-pointer transition"
              title="${tr('맨 위로', 'Back to Top', 'ページ上部へ')}"
            >
              <span>${tr('맨 위로 ↑', 'Top ↑', '上へ ↑')}</span>
            </button>

            ${
              ep >= 40
                ? `<button
              type="button"
              data-testid="book-ep40-restart-btn"
              data-action="book-jump-episode"
              data-episode="1"
              class="hs-promo-cta-purple flex-1 py-3.5 px-4 text-xs sm:text-sm font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>🔄 ${tr('대단원 완결 · 제1화부터 다시 읽기', 'Finale · Read Again from EP.1', '完結 · 第1話から読み直す')}</span>
            </button>`
                : `<button
              type="button"
              data-action="book-next-episode"
              class="hs-promo-cta-purple flex-1 py-3.5 px-4 text-xs sm:text-sm font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-2 cursor-pointer"
            >
              <span>${tr(`다음화 (제${ep + 1}화)`, `Next (EP.${ep + 1})`, `次話 (第${ep + 1}話)`)} ▶</span>
            </button>`
            }
          </div>

          <!-- External Official Serialization Links -->
          <div class="mt-8 p-4 bg-[#2f1b0c]/10 border border-[#8b5a2b]/40 rounded-xl space-y-3">
            <span class="text-xs font-extrabold text-[#4a2e16] block">${tr('공식 연재처 바로가기:', 'Official Serialization Links:', '公式連載プラットフォーム:')}</span>
            <div class="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
              <a
                href="${EXTERNAL_LINKS.naverNovel}"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2.5 bg-[#f8ebd2]/80 text-[#2f1b0c] hover:bg-[#fff6e3] border border-[#8b5a2b]/50 text-xs font-extrabold rounded-full min-h-[44px] flex items-center justify-center text-center no-underline transition"
              >
                ${tr('네이버 시리즈 ↗', 'Naver Series ↗', 'NAVERシリーズ ↗')}
              </a>
              <a
                href="${EXTERNAL_LINKS.munpiaNovel}"
                target="_blank"
                rel="noopener noreferrer"
                class="px-4 py-2.5 bg-[#f8ebd2]/80 text-[#2f1b0c] hover:bg-[#fff6e3] border border-[#8b5a2b]/50 text-xs font-extrabold rounded-full min-h-[44px] flex items-center justify-center text-center no-underline transition"
              >
                ${tr('문피아 소설 ↗', 'Munpia Novel ↗', 'Munpiaウェブ小説 ↗')}
              </a>
            </div>
          </div>

        </article>
      </main>
    </div>
  `;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
