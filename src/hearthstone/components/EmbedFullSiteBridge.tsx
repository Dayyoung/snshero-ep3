import React, { useEffect, useMemo, useState } from 'react';
import { useHeroLanguage } from '../../i18n/heroLang';
import { detectEmbedSource, getFullSiteLaunchUrl } from '../portalBridge';

interface EmbedFullSiteBridgeProps {
  /** Current active game screen (e.g. 'BOX_HUB', 'BATTLE', 'HERO_SELECT', 'COLLECTION', 'PACK_OPENING'). */
  screen: string;
  /** Number of battles completed/exited in the current session. */
  battlesCompletedInSession: number;
  /** Highest unlocked story episode in player profile. */
  storyProgressEp: number;
}

const SESSION_DISMISSED_KEY = 'snshero_embed_cta_dismissed_v1';

export const EmbedFullSiteBridge: React.FC<EmbedFullSiteBridgeProps> = ({
  screen,
  battlesCompletedInSession,
  storyProgressEp,
}) => {
  const { lang, tr } = useHeroLanguage();
  const embedSource = useMemo(() => detectEmbedSource(), []);
  const [modalOpen, setModalOpen] = useState(false);
  const [bannerMinimized, setBannerMinimized] = useState(false);
  const [timerReached, setTimerReached] = useState(false);

  useEffect(() => {
    if (!embedSource) return;
    const timer = window.setTimeout(() => {
      setTimerReached(true);
    }, 150_000); // 2.5 minutes of engagement
    return () => window.clearTimeout(timer);
  }, [embedSource]);

  useEffect(() => {
    if (!embedSource) return;
    // Never interrupt active battle gameplay
    if (screen === 'BATTLE') return;

    let alreadyDismissed = false;
    try {
      alreadyDismissed = window.sessionStorage.getItem(SESSION_DISMISSED_KEY) === '1';
    } catch {
      alreadyDismissed = false;
    }
    if (alreadyDismissed) return;

    const shouldPrompt =
      battlesCompletedInSession >= 1 || storyProgressEp >= 2 || timerReached;
    if (shouldPrompt) {
      setModalOpen(true);
    }
  }, [embedSource, screen, battlesCompletedInSession, storyProgressEp, timerReached]);

  if (!embedSource) return null;

  const fullSiteUrl = getFullSiteLaunchUrl(embedSource, lang);

  const dismissModal = () => {
    setModalOpen(false);
    try {
      window.sessionStorage.setItem(SESSION_DISMISSED_KEY, '1');
    } catch {
      // ignore sandboxed storage restriction
    }
  };

  return (
    <>
      {/* Non-intrusive bottom-left pill outside active battle so HUD/hand controls are never blocked */}
      {screen !== 'BATTLE' && (
        <div
          data-testid="embed-fullsite-bar"
          className="fixed bottom-3 left-3 z-[95] flex items-center gap-1.5"
        >
          {bannerMinimized ? (
            <button
              type="button"
              onClick={() => setBannerMinimized(false)}
              className="min-h-[44px] min-w-[44px] rounded-full border border-amber-400/60 bg-slate-950/90 px-3 text-xs font-extrabold text-amber-300 shadow-lg backdrop-blur-sm transition hover:bg-slate-900"
              aria-label={tr('공식 사이트 안내 펼치기', 'Expand official site link')}
            >
              ↗ SNSHero
            </button>
          ) : (
            <div className="flex items-center gap-1.5 rounded-full border border-amber-400/50 bg-slate-950/92 py-1 pl-3 pr-1.5 text-xs text-amber-100 shadow-xl backdrop-blur-md">
              <a
                href={fullSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                data-testid="embed-fullsite-pill-link"
                className="flex min-h-[36px] items-center gap-1.5 font-extrabold text-amber-300 underline-offset-2 hover:text-amber-200 hover:underline"
              >
                <span>✦</span>
                <span>
                  {tr(
                    'SNSHero.com 공식 풀버전 열기 ↗',
                    'Play Full Version on SNSHero.com ↗',
                  )}
                </span>
              </a>
              <button
                type="button"
                onClick={() => setBannerMinimized(true)}
                className="flex h-9 w-9 items-center justify-center rounded-full text-slate-400 transition hover:bg-white/10 hover:text-white"
                aria-label={tr('접기', 'Minimize')}
              >
                ✕
              </button>
            </div>
          )}
        </div>
      )}

      {/* Aha-moment transition modal shown after 1+ battle or 2.5 min play (never during battle) */}
      {modalOpen && screen !== 'BATTLE' && (
        <div
          data-testid="embed-fullsite-modal"
          className="fixed inset-0 z-[140] flex items-center justify-center bg-black/80 p-4 backdrop-blur-sm"
        >
          <div className="max-h-[90dvh] w-full max-w-md overflow-y-auto rounded-2xl border border-amber-400/45 bg-slate-950/95 p-5 text-left text-amber-50 shadow-2xl sm:p-6">
            <div className="flex items-start justify-between gap-3">
              <div>
                <span className="inline-block rounded-md border border-amber-400/40 bg-amber-500/15 px-2 py-0.5 text-[11px] font-extrabold tracking-wide text-amber-300">
                  {tr('공식 풀버전 안내', 'OFFICIAL FULL VERSION')}
                </span>
                <h2 className="mt-2 text-lg font-extrabold leading-snug text-white sm:text-xl">
                  {tr(
                    '재미있게 플레이하셨나요? 공식 사이트에서 이어하세요!',
                    'Enjoying SNSHero? Continue on the Official Site!',
                  )}
                </h2>
              </div>
              <button
                type="button"
                onClick={dismissModal}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl border border-white/15 bg-white/5 text-base font-bold text-slate-300 transition hover:bg-white/15 hover:text-white"
                aria-label={tr('닫기', 'Close')}
              >
                ✕
              </button>
            </div>

            <p className="mt-2.5 text-xs leading-relaxed text-slate-300 sm:text-sm">
              {tr(
                '외부 포털 임베드(iframe) 환경에서는 브라우저 보안 정책상 카드 덱과 전설 카드 저장 데이터가 초기화될 수 있습니다. 공식 사이트(SNSHero.com)에서 무료로 안전하게 이어서 플레이하세요.',
                'Inside portal iframes, browser privacy rules may reset your saved decks and Legendary cards. Open the official SNSHero.com site for permanent local saves and full-screen play.',
              )}
            </p>

            <ul className="mt-3.5 space-y-2 rounded-xl border border-white/10 bg-white/5 p-3.5 text-xs text-amber-100/95 sm:text-sm">
              <li>
                •{' '}
                {tr(
                  '내 382종 카드 컬렉션 & 30장 커스텀 덱 영구 저장',
                  'Permanent saves for all 382 cards & custom 30-card decks',
                )}
              </li>
              <li>
                •{' '}
                {tr(
                  '40화 성우 풀보이스 스토리(3배 각성) · 공식 랭킹전 · 보가트의 도박장',
                  '40-EP Voiced Story (3x Awakening) · Ranked Ladder · Bogart’s Gambling Hall',
                )}
              </li>
              <li>
                •{' '}
                {tr(
                  '설치·가입 없이 첫 방문 무료 3팩 + 250G & 10개국어 풀스크린 지원',
                  'Zero install, zero signup — Free 3 Packs + 250G & 10-language full screen',
                )}
              </li>
            </ul>

            <div className="mt-5 flex flex-col gap-2.5">
              <a
                href={fullSiteUrl}
                target="_blank"
                rel="noopener noreferrer"
                onClick={dismissModal}
                data-testid="embed-fullsite-modal-cta"
                className="flex min-h-[48px] w-full items-center justify-center rounded-xl bg-amber-400 px-4 text-sm font-black text-slate-950 shadow-lg transition hover:bg-amber-300"
              >
                {tr(
                  'SNSHero.com 공식 사이트에서 이어하기 ↗',
                  'Continue Full Version on SNSHero.com ↗',
                )}
              </a>
              <button
                type="button"
                onClick={dismissModal}
                data-testid="embed-fullsite-modal-dismiss"
                className="flex min-h-[44px] w-full items-center justify-center rounded-xl border border-white/15 bg-white/5 px-4 text-xs font-bold text-slate-300 transition hover:bg-white/10 hover:text-white sm:text-sm"
              >
                {tr('여기서 계속 체험하기', 'Keep Playing Demo Here')}
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
