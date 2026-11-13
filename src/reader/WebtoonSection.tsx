/**
 * src/landing/views/WebtoonSection.tsx
 *
 * Official 40-Episode Webtoon / Cartoon Reader View for SNSHero Static Landing (#webtoon).
 * Strictly complies with DESIGN.md OpenCode Terminal-Flat design:
 *   - Monospace typography (font-mono)
 *   - Flat surfaces (#fdfcfc, #201d1d) with 1px hairline borders
 *   - 0px container radii (rounded-none), max 4px button/badge radii (rounded-sm)
 *   - 44px+ minimum touch targets for all interactive controls
 *
 * Displays all 40 episodes (840+ panels) of 《눈히어로.com - 카단의 여정》
 * as a vertical continuous scrolling webtoon strip with panel images and clean dialogues.
 * Special visual effect letters (SFX cues) are cleanly removed.
 * Fullscreen / Lightbox mode features Left/Right pagination buttons with auto-advance to next episode.
 */

import { EXTERNAL_LINKS } from './types';
import WEBTOON_MANIFEST_DATA from '../content/webtoonEpisodeManifest.json';
import { chapterTitles } from '../content/kadanRpgStory';
import { isKoreanLanguage, tr } from './i18n';

export interface WebtoonDialogueItem {
  speakerKo?: string;
  speakerEn?: string;
  textKo?: string;
  textEn?: string;
  bubbleType?: string;
  position?: string;
  characterCardId?: number;
}

export interface WebtoonImageItem {
  index: number;
  fileName?: string;
  imageUrl: string;
  localArtUrl?: string;
  type?: string;
  narrationKo?: string;
  narrationEn?: string;
  characters?: string[];
  background?: string;
  dialogues?: WebtoonDialogueItem[];
  isKeyClimax?: boolean;
}

export interface WebtoonManifestEpisode {
  episodeNumber: number;
  episodeTitle: string;
  episodeTitleKo?: string;
  totalImages: number;
  images: WebtoonImageItem[];
}

const MANIFEST = WEBTOON_MANIFEST_DATA as unknown as Record<string, WebtoonManifestEpisode>;

let currentWebtoonEpisode: number = 1;
let isWebtoonIndexOpen: boolean = false;

// Lightbox (Fullscreen Zoom) State
let zoomedEpisode: number = 1;
let zoomedSceneIndex: number | null = null; // null indicates lightbox is closed

export function getWebtoonEpisodeNum(): number {
  return currentWebtoonEpisode;
}

export function setWebtoonEpisodeNum(ep: number, updateUrl: boolean = true): void {
  if (typeof ep !== 'number' || isNaN(ep)) ep = 1;
  currentWebtoonEpisode = Math.max(1, Math.min(40, Math.floor(ep)));

  if (updateUrl && typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      url.hash = '';
      url.searchParams.set('ep', String(currentWebtoonEpisode));
      window.history.replaceState({ view: 'webtoon', ep: currentWebtoonEpisode }, '', url.toString());
    } catch {
      // Ignore URL replacement errors in sandboxed iframes
    }
  }
}

export function initWebtoonEpisodeFromUrl(): void {
  if (typeof window === 'undefined') return;
  const searchMatch = (window.location.search || '').match(/[?&]ep=(\d+)/);
  const hashMatch = (window.location.hash || '').match(/ep=(\d+)/);
  const match = searchMatch || hashMatch;
  if (match && match[1]) {
    const epNum = parseInt(match[1], 10);
    if (!isNaN(epNum) && epNum >= 1 && epNum <= 40) {
      currentWebtoonEpisode = epNum;
    }
  }
}

export function isWebtoonLightboxOpen(): boolean {
  return zoomedSceneIndex !== null;
}

export function closeWebtoonLightbox(): void {
  zoomedSceneIndex = null;
}

export function handleWebtoonAction(action: string, target?: HTMLElement): void {
  if (action === 'webtoon-prev-episode') {
    if (currentWebtoonEpisode > 1) {
      setWebtoonEpisodeNum(currentWebtoonEpisode - 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else if (action === 'webtoon-next-episode') {
    if (currentWebtoonEpisode < 40) {
      setWebtoonEpisodeNum(currentWebtoonEpisode + 1);
      if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  } else if (action === 'webtoon-jump-episode') {
    const epAttr = target?.getAttribute('data-episode');
    if (epAttr) {
      const epNum = parseInt(epAttr, 10);
      if (!isNaN(epNum)) {
        setWebtoonEpisodeNum(epNum);
        isWebtoonIndexOpen = false;
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  } else if (action === 'webtoon-select-episode') {
    const select = target as HTMLSelectElement | null;
    if (select && select.value) {
      const val = parseInt(select.value, 10);
      if (!isNaN(val)) {
        setWebtoonEpisodeNum(val);
        if (typeof window !== 'undefined') window.scrollTo({ top: 0, behavior: 'smooth' });
      }
    }
  } else if (action === 'webtoon-toggle-index') {
    isWebtoonIndexOpen = !isWebtoonIndexOpen;
  } else if (action === 'webtoon-zoom-image') {
    const epAttr = target?.getAttribute('data-episode');
    const sceneAttr = target?.getAttribute('data-scene-index');
    const epNum = epAttr ? parseInt(epAttr, 10) : currentWebtoonEpisode;
    const sceneIdx = sceneAttr ? parseInt(sceneAttr, 10) : 0;
    
    zoomedEpisode = isNaN(epNum) ? currentWebtoonEpisode : Math.max(1, Math.min(40, epNum));
    zoomedSceneIndex = isNaN(sceneIdx) ? 0 : Math.max(0, sceneIdx);
  } else if (action === 'webtoon-close-zoom') {
    zoomedSceneIndex = null;
  } else if (action === 'webtoon-lightbox-prev') {
    if (zoomedSceneIndex === null) return;
    if (zoomedSceneIndex > 0) {
      zoomedSceneIndex -= 1;
    } else if (zoomedEpisode > 1) {
      // Move to the last panel of previous episode
      zoomedEpisode -= 1;
      setWebtoonEpisodeNum(zoomedEpisode);
      const prevImages = MANIFEST[String(zoomedEpisode)]?.images || [];
      zoomedSceneIndex = Math.max(0, prevImages.length - 1);
    }
  } else if (action === 'webtoon-lightbox-next') {
    if (zoomedSceneIndex === null) return;
    const curImages = MANIFEST[String(zoomedEpisode)]?.images || [];
    if (zoomedSceneIndex < curImages.length - 1) {
      zoomedSceneIndex += 1;
    } else if (zoomedEpisode < 40) {
      // Reached the end of current episode -> Advance to next episode
      zoomedEpisode += 1;
      setWebtoonEpisodeNum(zoomedEpisode);
      zoomedSceneIndex = 0;
    }
  } else if (action === 'webtoon-scroll-top') {
    if (typeof window !== 'undefined') {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    }
  }
}

export function renderWebtoonSection(): string {
  initWebtoonEpisodeFromUrl();

  const cacheBustVer = `20261110_${Math.floor(Date.now() / 60000)}`;
  const ep = currentWebtoonEpisode;
  const isKo = isKoreanLanguage();
  const epData = MANIFEST[String(ep)];
  const rawTitle = isKo
    ? epData?.episodeTitleKo || chapterTitles[ep - 1]?.titleKo || epData?.episodeTitle || `제 ${ep}화`
    : epData?.episodeTitle || chapterTitles[ep - 1]?.titleEn || epData?.episodeTitleKo || `Episode ${ep}`;
  const images: WebtoonImageItem[] = epData?.images || [];
  const totalPanels = images.length;

  // Build Lightbox modal HTML if active
  let lightboxModalHtml = '';
  if (zoomedSceneIndex !== null) {
    const curEp = zoomedEpisode;
    const curEpData = MANIFEST[String(curEp)];
    const curTitle = isKo
      ? curEpData?.episodeTitleKo || chapterTitles[curEp - 1]?.titleKo || curEpData?.episodeTitle || `제 ${curEp}화`
      : curEpData?.episodeTitle || chapterTitles[curEp - 1]?.titleEn || curEpData?.episodeTitleKo || `Episode ${curEp}`;
    const curImages = curEpData?.images || [];
    const maxIdx = Math.max(0, curImages.length - 1);
    const validIdx = Math.max(0, Math.min(maxIdx, zoomedSceneIndex));
    const activeImage: WebtoonImageItem | undefined = curImages[validIdx];

    const rawImgSrc = activeImage?.imageUrl || activeImage?.localArtUrl || '';
    const imgSrc = rawImgSrc ? `${rawImgSrc}${rawImgSrc.includes('?') ? '&' : '?'}v=${cacheBustVer}` : '';
    const narration = isKo
      ? activeImage?.narrationKo || activeImage?.narrationEn || ''
      : (activeImage?.narrationEn || activeImage?.narrationKo || '').replace(/\s*\(눈히어로\.com\)/g, '');
    const dialogues = activeImage?.dialogues || [];
    const isFirstPanelOfFirstEp = curEp <= 1 && validIdx <= 0;
    const isLastPanelOfLastEp = curEp >= 40 && validIdx >= maxIdx;
    const isAtEpisodeEnd = validIdx >= maxIdx;

    lightboxModalHtml = `
      <div
        id="webtoon-lightbox-modal"
        class="fixed inset-0 z-50 bg-black/95 flex flex-col justify-between p-2 sm:p-4 select-none backdrop-blur-md"
      >
        <!-- Lightbox Top Controls Bar -->
        <header class="w-full max-w-6xl mx-auto flex items-center justify-between gap-3 px-2 sm:px-4 py-2 border-b border-amber-700/40 text-[#f8ebd2] shrink-0">
          <div class="flex items-center gap-2 truncate">
            <span class="px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold rounded-full tracking-wider uppercase shrink-0">
              EP.${String(curEp).padStart(2, '0')}
            </span>
            <span class="text-xs sm:text-sm font-extrabold text-amber-100 truncate">
              ${isKo ? `제${curEp}화` : `EP.${String(curEp).padStart(2, '0')}`} ${curTitle}
            </span>
            <span class="text-xs text-amber-300/70 font-bold shrink-0">
              [${validIdx + 1} / ${curImages.length}]
            </span>
          </div>

          <div class="flex items-center gap-2 shrink-0">
            <button
              type="button"
              data-action="webtoon-close-zoom"
              class="px-4 py-2 bg-[#2a180c] hover:bg-[#3a2211] text-amber-100 text-xs font-extrabold rounded-full min-h-[44px] flex items-center justify-center gap-1 cursor-pointer transition border border-amber-500/40"
              title="${tr('전체화면 닫기 (ESC)', 'Close Fullscreen (ESC)', '全画面を閉じる (ESC)')}"
            >
              <span>✕ ${tr('닫기', 'Close', '閉じる')}</span>
            </button>
          </div>
        </header>

        <!-- Lightbox Center: Image with Left / Right Navigation Buttons -->
        <div class="relative w-full flex-1 flex items-center justify-center my-2 overflow-hidden px-1 sm:px-16">
          
          <!-- Prev Button (Left) -->
          <button
            type="button"
            data-action="webtoon-lightbox-prev"
            ${isFirstPanelOfFirstEp ? 'disabled' : ''}
            class="absolute left-2 sm:left-4 z-20 w-12 sm:w-16 h-16 sm:h-24 bg-[#1b1008]/85 hover:bg-[#2a180c] text-amber-100 disabled:opacity-20 border border-amber-600/50 hover:border-amber-400 text-xl sm:text-2xl font-black rounded-xl flex items-center justify-center cursor-pointer transition-all shadow-lg active:scale-95"
            aria-label="${tr('이전 컷 보기', 'Previous Panel', '前のカット')}"
            title="${validIdx === 0 && curEp > 1 ? tr('이전 화 마지막 컷으로 이동', 'Go to last panel of previous episode', '前話の最後のカットへ移動') : tr('이전 컷 (◀)', 'Previous Panel (◀)', '前のカット (◀)')}"
          >
            ◀
          </button>

          <!-- Current Panel Image -->
          <div class="relative max-h-full max-w-full flex items-center justify-center">
            <img
              src="${imgSrc}"
              alt="EP.${curEp} #${validIdx + 1}"
              class="max-h-[60vh] sm:max-h-[72vh] md:max-h-[76vh] w-auto max-w-full object-contain hs-promo-gold-frame rounded-xl transition-all"
              onerror="this.onerror=null; this.src='/webtoon-assets/episode_01/scene_00.webp';"
            />
          </div>

          <!-- Next Button (Right) -->
          <button
            type="button"
            data-action="webtoon-lightbox-next"
            ${isLastPanelOfLastEp ? 'disabled' : ''}
            class="absolute right-2 sm:right-4 z-20 w-12 sm:w-16 h-16 sm:h-24 bg-[#1b1008]/85 hover:bg-[#2a180c] text-amber-100 disabled:opacity-20 border ${
              isAtEpisodeEnd ? 'border-amber-400 text-amber-300' : 'border-amber-600/50 hover:border-amber-400'
            } text-xl sm:text-2xl font-black rounded-xl flex flex-col items-center justify-center cursor-pointer transition-all shadow-lg active:scale-95"
            aria-label="${tr('다음 컷 보기', 'Next Panel', '次のカット')}"
            title="${isAtEpisodeEnd ? tr('다음 화로 이동 (▶)', 'Go to Next Episode (▶)', '次話へ移動 (▶)') : tr('다음 컷 (▶)', 'Next Panel (▶)', '次のカット (▶)')}"
          >
            <span>▶</span>
            ${
              isAtEpisodeEnd && curEp < 40
                ? `<span class="text-[9px] font-extrabold tracking-tight text-amber-300 uppercase mt-0.5">${tr('다음화', 'NEXT EP', '次話')}</span>`
                : ''
            }
          </button>
        </div>

        <!-- Lightbox Bottom Dialogue & Caption Bar -->
        <footer class="w-full max-w-4xl mx-auto px-4 py-3 bg-[#1b1008]/95 border border-amber-700/50 rounded-xl text-[#f8ebd2] space-y-2 shrink-0">
          <div class="flex items-center justify-between text-[11px] text-amber-200/70 pb-1 border-b border-amber-700/30">
            <div class="flex items-center gap-2">
              <span class="font-extrabold text-amber-200">
                ${validIdx === 0 ? 'TITLE CARD' : `SCENE #${String(validIdx).padStart(2, '0')}`}
              </span>
              ${
                activeImage?.isKeyClimax
                  ? `<span class="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[10px] font-extrabold rounded-full">★ ${tr('명장면', 'CLIMAX', '名場面')}</span>`
                  : ''
              }
            </div>
            <div class="flex items-center gap-1.5 text-xs">
              <span class="text-amber-200/70">${tr('컷', 'Panel', 'カット')}</span>
              <span class="text-amber-400 font-extrabold">${validIdx + 1}</span>
              <span class="text-amber-200/40">/</span>
              <span>${curImages.length}</span>
              ${
                isAtEpisodeEnd && curEp < 40
                  ? `<span class="ml-2 px-2 py-0.5 bg-amber-600 text-white font-extrabold text-[10px] rounded-full">▶ ${tr('누르면 다음 화 이동', 'Click ▶ for Next Episode', '▶で次話へ移動')}</span>`
                  : ''
              }
            </div>
          </div>

          <!-- Dialogues & Clean Narration (Zero SFX letters) -->
          <div class="max-h-24 sm:max-h-28 overflow-y-auto space-y-1.5 text-xs sm:text-sm pr-1">
            ${
              dialogues.length > 0
                ? dialogues
                    .map((dlg) => {
                      const speaker = isKo
                        ? dlg.speakerKo || dlg.speakerEn || '내레이션'
                        : dlg.speakerEn || dlg.speakerKo || 'Narration';
                      const text = isKo
                        ? dlg.textKo || dlg.textEn || ''
                        : dlg.textEn || dlg.textKo || '';
                      const isNarration = speaker === '내레이션' || speaker === 'Narration';

                      if (isNarration) {
                        return `
                          <div class="text-amber-100/90 leading-relaxed border-l-2 border-amber-500 pl-2.5 py-0.5">
                            ${escapeHtml(text)}
                          </div>
                        `;
                      }

                      return `
                        <div class="flex items-start gap-2 text-[#f8ebd2] leading-relaxed">
                          <span class="px-2 py-0.5 bg-amber-600/25 border border-amber-400/40 text-amber-200 text-[11px] font-extrabold rounded-full shrink-0">
                            ${escapeHtml(speaker)}
                          </span>
                          <span class="font-bold">
                            “${escapeHtml(text.replace(/^[“"']+|[”"']+$/g, ''))}”
                          </span>
                        </div>
                      `;
                    })
                    .join('')
                : narration
                ? `
                <div class="text-amber-100/90 leading-relaxed border-l-2 border-amber-500/60 pl-2.5 py-0.5">
                  ${escapeHtml(narration)}
                </div>
              `
                : `
                <div class="text-amber-200/50 text-xs italic">
                  ${tr('대사 및 내레이션이 없는 씬입니다.', 'No dialogue or narration in this scene.', 'セリフ・ナレーションのないシーンです。')}
                </div>
              `
            }
          </div>
        </footer>
      </div>
    `;
  }

  return `
    <div class="w-full flex flex-col text-[#f8ebd2] select-none bg-[#120b06]">
      <!-- 1. Tavern Wood Sub-Navigation Controls Bar -->
      <section class="w-full bg-[#1b1008]/95 border-b border-amber-700/40 backdrop-blur-md sticky top-16 sm:top-[70px] z-30 shadow-[0_8px_24px_rgba(0,0,0,0.65)]">
        <div class="w-full max-w-4xl mx-auto px-4 py-3 sm:px-6">
          <div class="flex flex-wrap items-center justify-between gap-2.5">
            <!-- Left: Badge & Title -->
            <div class="flex items-center gap-2.5 truncate">
              <span class="px-2.5 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[11px] font-extrabold rounded-full tracking-wider uppercase shrink-0">
                WEBTOON EP.${String(ep).padStart(2, '0')}
              </span>
              <span class="text-xs sm:text-sm font-extrabold text-amber-100 truncate hs-outline-sm">
                ${rawTitle}
              </span>
              <span class="text-[11px] text-amber-200/70 font-bold shrink-0 hidden sm:inline">
                (${totalPanels}${tr('컷', ' panels', 'カット')})
              </span>
            </div>

            <!-- Right: External Link & Index Toggle -->
            <div class="flex items-center gap-2 shrink-0">
              <a
                href="${EXTERNAL_LINKS.naverWebtoon}"
                target="_blank"
                rel="noopener noreferrer"
                class="hs-promo-cta-teal-dark px-3 py-1.5 text-xs font-extrabold rounded-full min-h-[36px] flex items-center gap-1 no-underline"
              >
                <span>${tr('네이버 웹툰 ↗', 'Naver Webtoon ↗', 'NAVERウェブトゥーン ↗')}</span>
              </a>

              <button
                type="button"
                data-action="webtoon-toggle-index"
                class="px-3.5 py-1.5 bg-amber-950/60 text-amber-200 hover:bg-amber-900/80 border border-amber-500/40 text-xs font-extrabold rounded-full min-h-[36px] flex items-center gap-1 cursor-pointer transition"
                title="${tr('전체 40화 목차 보기', 'View All 40 Episodes', '全40話の目次を表示')}"
              >
                <span>${isWebtoonIndexOpen ? tr('목차 닫기 ▲', 'Close Index ▲', '目次を閉じる ▲') : tr('전체 회차 ▼', 'All Episodes ▼', '全話一覧 ▼')}</span>
              </button>
            </div>
          </div>

          <!-- Quick Navigation Bar -->
          <div class="flex items-center justify-between gap-2 pt-3 border-t border-amber-700/30 mt-2.5">
            <!-- Prev Episode -->
            <button
              type="button"
              data-action="webtoon-prev-episode"
              ${ep <= 1 ? 'disabled' : ''}
              class="px-3.5 py-2 bg-[#2a180c] text-amber-100 hover:bg-[#3a2211] border border-amber-500/40 disabled:opacity-30 text-xs font-extrabold rounded-full min-h-[42px] flex items-center gap-1 cursor-pointer transition"
              aria-label="${tr('이전 화', 'Previous Episode', '前の話')}"
            >
              ◀ ${tr('이전화', 'Prev', '前話')}
            </button>

            <!-- Dropdown Episode Selector -->
            <div class="flex items-center gap-1.5 flex-1 max-w-xs mx-auto">
              <select
                id="webtoon-episode-select"
                data-action="webtoon-select-episode"
                class="w-full px-3 py-2 bg-[#120b06] text-[#f8ebd2] border border-amber-600/50 text-xs font-extrabold rounded-full min-h-[42px] cursor-pointer focus:outline-none focus:border-amber-400 text-center"
              >
                ${Array.from({ length: 40 }, (_, idx) => {
                  const num = idx + 1;
                  const item = MANIFEST[String(num)];
                  const title = isKo
                    ? item?.episodeTitleKo || chapterTitles[idx]?.titleKo || item?.episodeTitle || `제 ${num}화`
                    : item?.episodeTitle || chapterTitles[idx]?.titleEn || item?.episodeTitleKo || `Episode ${num}`;
                  const epPrefix = isKo ? `제${num}화` : `EP.${String(num).padStart(2, '0')}`;
                  return `
                    <option value="${num}" ${num === ep ? 'selected' : ''}>
                      ${epPrefix} - ${title}
                    </option>
                  `;
                }).join('')}
              </select>
            </div>

            <!-- Next Episode -->
            <button
              type="button"
              data-action="webtoon-next-episode"
              ${ep >= 40 ? 'disabled' : ''}
              class="hs-promo-cta-purple px-4 py-2 disabled:opacity-30 text-xs font-extrabold rounded-full min-h-[42px] flex items-center gap-1 cursor-pointer"
              aria-label="${tr('다음 화', 'Next Episode', '次の話')}"
            >
              ${tr('다음화', 'Next', '次話')} ▶
            </button>
          </div>
        </div>

        <!-- 40-Episode Quick Drawer (If Toggled Open) -->
        ${
          isWebtoonIndexOpen
            ? `
          <div class="w-full max-w-4xl mx-auto px-4 py-4 sm:px-6 bg-[#140c06] border-t border-amber-700/40">
            <div class="flex items-center justify-between pb-2 mb-3 border-b border-amber-700/30">
              <span class="text-xs font-extrabold text-amber-200">
                ${tr(
                  '웹툰 40화 전편 에피소드 선택 (클릭 시 즉시 이동)',
                  'Select from all 40 Webtoon Episodes (Click to jump)',
                  'ウェブトゥーン全40話選択（クリックで移動）'
                )}
              </span>
              <button
                type="button"
                data-action="webtoon-toggle-index"
                class="text-xs text-amber-300/80 hover:text-amber-100 font-extrabold p-1 cursor-pointer"
              >
                [${tr('닫기', 'Close', '閉じる')} ✕]
              </button>
            </div>
            <div class="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-5 gap-2 max-h-[320px] overflow-y-auto pr-1">
              ${Array.from({ length: 40 }, (_, idx) => {
                const num = idx + 1;
                const item = MANIFEST[String(num)];
                const title = isKo
                  ? item?.episodeTitleKo || chapterTitles[idx]?.titleKo || item?.episodeTitle || `제 ${num}화`
                  : item?.episodeTitle || chapterTitles[idx]?.titleEn || item?.episodeTitleKo || `Episode ${num}`;
                const isCurrent = num === ep;
                const epBadge = isKo ? `[${num}화]` : `[EP.${String(num).padStart(2, '0')}]`;
                return `
                  <button
                    type="button"
                    data-action="webtoon-jump-episode"
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
              }).join('')}
            </div>
          </div>
        `
            : ''
        }
      </section>

      <!-- 2. Episode Banner Card (Tavern Wood Header) -->
      <section class="hs-promo-tavern w-full py-7 sm:py-9 px-4 text-center">
        <div class="w-full max-w-3xl mx-auto space-y-2.5">
          <div class="flex items-center justify-center gap-2">
            <span class="px-3 py-0.5 bg-amber-500/20 border border-amber-400/50 text-amber-300 text-[10px] font-extrabold rounded-full tracking-widest uppercase">
              CANONICAL WEBTOON STRIP
            </span>
            <span class="text-xs font-extrabold text-amber-200">
              ${tr(`제 ${ep}화 / 40부작`, `Episode ${ep} / 40 Series`, `第${ep}話 / 全40部作`)}
            </span>
          </div>
          <h1 class="hs-title text-2xl sm:text-3xl md:text-4xl font-extrabold text-amber-100 tracking-tight m-0">
            ${rawTitle}
          </h1>
          <p class="text-xs sm:text-sm text-amber-200/75 m-0 pt-1">
            ${tr(
              `화면을 아래로 스크롤하여 컷신과 대사를 순서대로 감상하세요. (총 ${totalPanels}컷 · 클릭 시 전체화면 좌우 넘김 지원)`,
              `Scroll down to read panels and dialogues in sequence. (${totalPanels} panels total · Click any panel for fullscreen reader)`,
              `下にスクロールしてカットとセリフを順番にお楽しみください。（全${totalPanels}カット・クリックで全画面左右ページめくり対応）`
            )}
          </p>
        </div>
      </section>

      <div class="hs-promo-divider"></div>

      <!-- 3. Vertical Continuous Scroll Webtoon Strip -->
      <main class="w-full py-8 sm:py-12 px-2 sm:px-4 bg-[#120b06]">
        <div class="w-full max-w-2xl sm:max-w-3xl mx-auto space-y-8 sm:space-y-12">
          
          ${
            images.length === 0
              ? `
              <div class="p-8 text-center hs-promo-gold-frame rounded-2xl bg-[#1b1008] space-y-2">
                <p class="text-sm font-extrabold text-amber-100">${tr('웹툰 이미지를 준비 중입니다.', 'Preparing webtoon panels...', 'ウェブトゥーン画像を準備中です。')}</p>
                <p class="text-xs text-amber-200/70">${tr('잠시 후 다시 시도해 주세요.', 'Please try again shortly.', 'しばらくしてから再度お試しください。')}</p>
              </div>
            `
              : images
                  .map((img, idx) => {
                    const sceneIndex = img.index !== undefined ? img.index : idx;
                    const isTitleCard = sceneIndex === 0 || img.type === 'title_card';
                    const isEndingPromo = img.type === 'ending_promo';
                    const panelBadge = isTitleCard ? 'TITLE CARD' : `SCENE ${String(sceneIndex).padStart(2, '0')}`;
                    const koChapterTitle = chapterTitles[ep - 1]?.titleKo || '';
                    const mainNarration = isTitleCard
                      ? isKo && koChapterTitle
                        ? `제 ${ep} 화 · ${koChapterTitle}`
                        : ''
                      : isEndingPromo
                        ? ''
                        : isKo
                          ? img.narrationKo || img.narrationEn || ''
                          : (img.narrationEn || img.narrationKo || '').replace(/\s*\(눈히어로\.com\)/g, '');
                    const dialogues = img.dialogues || [];
                    const rawImgSrc = img.imageUrl || img.localArtUrl || '';
                    const imgSrc = rawImgSrc ? `${rawImgSrc}${rawImgSrc.includes('?') ? '&' : '?'}v=${cacheBustVer}` : '';

                    return `
                      <!-- Single Webtoon Panel Card (Gold Engraved Frame) -->
                      <article class="w-full bg-[#1b1008] hs-promo-gold-frame rounded-2xl overflow-hidden">
                        
                        <!-- Panel Header -->
                        <div class="bg-[#24160b] border-b border-amber-700/40 px-4 py-2.5 flex items-center justify-between text-xs">
                          <div class="flex items-center gap-2">
                            <span class="w-2 h-2 rounded-full bg-amber-400 inline-block shadow-[0_0_8px_rgba(251,191,36,0.8)]"></span>
                            <span class="font-extrabold text-amber-200 uppercase tracking-wider">
                              ${panelBadge}
                            </span>
                            ${
                              img.isKeyClimax
                                ? `
                              <span class="px-2 py-0.5 bg-amber-500/20 text-amber-300 border border-amber-400/50 text-[10px] font-extrabold rounded-full">
                                ★ ${tr('명장면', 'CLIMAX', '名場面')}
                              </span>
                            `
                                : ''
                            }
                          </div>
                          
                          <!-- Zoom Fullscreen Button -->
                          <button
                            type="button"
                            data-action="webtoon-zoom-image"
                            data-episode="${ep}"
                            data-scene-index="${sceneIndex}"
                            class="px-3 py-1 text-[11px] font-extrabold text-amber-200 hover:text-amber-100 bg-black/35 hover:bg-amber-900/50 border border-amber-600/40 rounded-full cursor-pointer transition"
                          >
                            ${tr('전체화면 🔍', 'Fullscreen 🔍', '全画面 🔍')}
                          </button>
                        </div>

                        <!-- Panel Image Frame -->
                        <div class="relative w-full bg-[#0d0704] flex items-center justify-center overflow-hidden">
                          <img
                            src="${imgSrc}"
                            alt="EP.${ep} ${panelBadge}"
                            loading="lazy"
                            decoding="async"
                            data-action="webtoon-zoom-image"
                            data-episode="${ep}"
                            data-scene-index="${sceneIndex}"
                            class="w-full h-auto block object-cover cursor-pointer hover:opacity-95 transition-opacity"
                            onerror="this.onerror=null; this.src='/webtoon-assets/episode_01/scene_00.webp';"
                            title="${tr('클릭하여 전체화면 모드로 감상', 'Click to view in fullscreen mode', 'クリックして全画面モードで鑑賞')}"
                          />
                        </div>

                        ${
                          isEndingPromo
                            ? `
                        <div class="bg-[#160d06] px-4 py-4 border-t border-amber-700/35 flex items-center justify-center">
                          <a
                            href="/game.html?mode=story"
                            class="hs-promo-cta-purple w-full sm:w-auto min-h-[44px] px-6 py-2.5 text-xs sm:text-sm font-extrabold rounded-full flex items-center justify-center gap-2 no-underline"
                          >
                            <span>▶ ${tr('웹툰 카드게임 바로 플레이 (SNSHero.com)', 'Play the Webtoon Card Game Now (SNSHero.com)', 'ウェブトゥーンカードゲームを今すぐプレイ (SNSHero.com)')}</span>
                          </a>
                        </div>
                        `
                            : ''
                        }

                        ${
                          dialogues.length > 0 || mainNarration
                            ? `
                        <!-- Dialogue & Narration Box -->
                        <div class="bg-[#160d06] p-4 sm:p-5 border-t border-amber-700/35 space-y-3">
                          
                          <!-- Character Speech Bubbles / Dialogue Quotes -->
                          ${
                            dialogues.length > 0
                              ? dialogues
                                  .map((dlg) => {
                                    const speaker = isKo
                                      ? dlg.speakerKo || dlg.speakerEn || '내레이션'
                                      : dlg.speakerEn || dlg.speakerKo || 'Narration';
                                    const text = isKo
                                      ? dlg.textKo || dlg.textEn || ''
                                      : dlg.textEn || dlg.textKo || '';
                                    const isNarration = speaker === '내레이션' || speaker === 'Narration';

                                    if (isNarration) {
                                      return `
                                        <div class="p-3 bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg text-xs sm:text-sm leading-relaxed text-amber-100/90 select-text">
                                          ${escapeHtml(text)}
                                        </div>
                                      `;
                                    }

                                    return `
                                      <div class="flex items-start gap-2.5 p-3 bg-[#22140a] border border-amber-700/40 rounded-xl select-text">
                                        <div class="shrink-0">
                                          <span class="px-2.5 py-0.5 bg-amber-600/25 border border-amber-400/40 text-amber-200 text-[11px] font-extrabold rounded-full tracking-wide">
                                            ${escapeHtml(speaker)}
                                          </span>
                                        </div>
                                        <div class="flex-1 text-xs sm:text-sm leading-relaxed text-[#f8ebd2] font-bold pt-0.5">
                                          “${escapeHtml(text.replace(/^[“"']+|[”"']+$/g, ''))}”
                                        </div>
                                      </div>
                                    `;
                                  })
                                  .join('')
                              : mainNarration
                              ? `
                              <div class="p-3 bg-amber-950/30 border-l-4 border-amber-500 rounded-r-lg text-xs sm:text-sm leading-relaxed text-amber-100/90 select-text">
                                ${escapeHtml(mainNarration)}
                              </div>
                            `
                              : ''
                          }

                          ${
                            dialogues.length > 0 &&
                            mainNarration &&
                            !dialogues.some((d) => d.textKo === mainNarration || d.textEn === mainNarration)
                              ? `
                              <div class="text-xs text-amber-200/70 leading-relaxed italic border-t border-amber-700/30 pt-2 select-text">
                                ※ ${escapeHtml(mainNarration)}
                              </div>
                            `
                              : ''
                          }

                        </div>
                        `
                            : ''
                        }

                      </article>
                    `;
                  })
                  .join('')
          }

          <!-- Bottom Endmark & Navigation -->
          <div class="pt-8 pb-4 text-center border-t border-amber-700/40 space-y-4">
            <div class="space-y-1">
              <span class="text-xs font-extrabold text-amber-300 tracking-widest uppercase">
                ${tr(
                  `— 《카단의 여정》 웹툰 제 ${ep}화 완독 —`,
                  `— End of Kadan's Journey Webtoon Episode ${ep} —`,
                  `— 《カダンの旅》 ウェブトゥーン 第${ep}話 読了 —`
                )}
              </span>
              <p class="text-xs text-amber-200/70 m-0">
                ${tr(
                  '다음 에피소드에서 전설의 배틀과 스토리가 계속됩니다.',
                  'The legendary battles and story continue in the next episode.',
                  '次のエピソードでも伝説のバトルと物語が続きます。'
                )}
              </p>
            </div>

            <!-- Big Prev / Top / Next Navigation Buttons -->
            <div class="flex flex-wrap sm:flex-nowrap items-center justify-between gap-3 pt-2">
              <button
                type="button"
                data-action="webtoon-prev-episode"
                ${ep <= 1 ? 'disabled' : ''}
                class="flex-1 py-3.5 px-4 bg-[#2a180c] text-amber-100 hover:bg-[#3a2211] border border-amber-500/40 disabled:opacity-30 text-xs sm:text-sm font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-1 cursor-pointer transition"
              >
                <span>◀ ${tr(`이전화 (제${Math.max(1, ep - 1)}화)`, `Prev (EP.${Math.max(1, ep - 1)})`, `前話 (第${Math.max(1, ep - 1)}話)`)}</span>
              </button>

              <button
                type="button"
                data-action="webtoon-scroll-top"
                class="px-5 py-3.5 bg-[#1b1008] text-amber-200 hover:bg-[#2a180c] border border-amber-600/50 text-xs font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-1 cursor-pointer transition"
                title="${tr('맨 위로', 'Back to Top', 'ページ上部へ')}"
              >
                <span>${tr('맨 위로 ↑', 'Top ↑', '上へ ↑')}</span>
              </button>

              <button
                type="button"
                data-action="webtoon-next-episode"
                ${ep >= 40 ? 'disabled' : ''}
                class="hs-promo-cta-purple flex-1 py-3.5 px-4 disabled:opacity-30 text-xs sm:text-sm font-extrabold rounded-full min-h-[48px] flex items-center justify-center gap-1 cursor-pointer"
              >
                <span>${tr(`다음화 (제${Math.min(40, ep + 1)}화)`, `Next (EP.${Math.min(40, ep + 1)})`, `次話 (第${Math.min(40, ep + 1)}話)`)} ▶</span>
              </button>
            </div>
          </div>

        </div>
      </main>

      <!-- 4. Lightbox Fullscreen Modal with Left/Right Buttons & Auto-advance -->
      ${lightboxModalHtml}

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
