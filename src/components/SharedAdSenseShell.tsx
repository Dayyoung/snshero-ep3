import React, { useEffect, useRef, useState } from 'react';
import {
  initAdSenseContainmentObserver,
  isAdRemoved,
  isDesktopWideLandscape,
  protectLinksFromVignette,
  pushAdSenseTags,
  syncAdSenseRatioLayout,
} from '../hearthstone/services/adsenseManager';

export interface SharedAdSenseShellProps {
  pageKey: string;
  theme?: 'tavern' | 'terminal';
  children: React.ReactNode;
}

/**
 * Shared Google AdSense layout wrapper for scrollable pages (/, /promo, /sns).
 * Uses fixed container heights (52px top banner on mobile/tablet, 160x600 sticky wings
 * on >=1280px landscape desktop) matching adsenseManager.ts to guarantee zero CLS.
 */
export const SharedAdSenseShell: React.FC<SharedAdSenseShellProps> = ({
  pageKey,
  theme = 'tavern',
  children,
}) => {
  const [adRemoved, setAdRemoved] = useState<boolean>(() => isAdRemoved());
  const [desktopWide] = useState<boolean>(() => isDesktopWideLandscape());
  const rootRef = useRef<HTMLDivElement | null>(null);
  const mobileTopRef = useRef<HTMLDivElement | null>(null);
  const leftGutterRef = useRef<HTMLElement | null>(null);
  const rightGutterRef = useRef<HTMLElement | null>(null);

  useEffect(() => {
    initAdSenseContainmentObserver();
    syncAdSenseRatioLayout(pageKey);
    pushAdSenseTags(pageKey);

    const handleResize = () => {
      syncAdSenseRatioLayout(pageKey);
    };
    const handleStorage = () => {
      setAdRemoved(isAdRemoved());
      syncAdSenseRatioLayout(pageKey);
    };

    window.addEventListener('resize', handleResize);
    window.addEventListener('orientationchange', handleResize);
    window.addEventListener('storage', handleStorage);
    window.addEventListener('snshero_ad_removed_updated', handleStorage);
    return () => {
      window.removeEventListener('resize', handleResize);
      window.removeEventListener('orientationchange', handleResize);
      window.removeEventListener('storage', handleStorage);
      window.removeEventListener('snshero_ad_removed_updated', handleStorage);
    };
  }, [pageKey]);

  useEffect(() => {
    if (rootRef.current) {
      protectLinksFromVignette(rootRef.current);
    }
    syncAdSenseRatioLayout(pageKey);
    pushAdSenseTags(pageKey);
  }, [pageKey, adRemoved]);

  const isTerminal = theme === 'terminal';
  const shellBg = isTerminal ? 'bg-[#090d16] text-[#fdfcfc]' : 'bg-[#120b06] text-[#f8ebd2]';
  const gutterBg = isTerminal
    ? 'border-white/10 bg-[#070a12]'
    : 'border-[#c8a158]/20 bg-[#0c0805]';
  const cardBorder = isTerminal
    ? 'border-white/15 bg-black/45'
    : 'border-[#c8a158]/25 bg-black/50';
  const labelText = isTerminal ? 'text-stone-400' : 'text-amber-200/65';
  const topBorder = isTerminal
    ? 'border-white/15 bg-[#070a12]'
    : 'border-[#c8a158]/25 bg-[#100a06]';

  return (
    <div ref={rootRef} className={`flex min-h-screen w-full flex-col ${shellBg}`}>
      {!adRemoved && (
        <div
          style={{
            display: desktopWide ? 'none' : 'block',
            height: 52,
            minHeight: 52,
            maxHeight: 52,
          }}
          className="w-full shrink-0 overflow-hidden"
        >
          <div
            id="adsense-mobile-top"
            ref={mobileTopRef}
            style={{
              display: desktopWide ? 'none' : 'block',
              height: 52,
              minHeight: 52,
              maxHeight: 52,
              isolation: 'isolate',
            }}
            className={`adsense-banner-top relative z-0 w-full shrink-0 select-none overflow-hidden border-b px-1 text-center ${topBorder}`}
            aria-label="Google AdSense Top Banner"
          >
            <div className="adsense-banner-inner relative mx-auto flex h-[50px] max-w-[360px] items-center justify-center gap-1.5 overflow-hidden">
              <span
                className={`shrink-0 rounded border px-1 py-0.5 text-[8px] font-extrabold tracking-wider uppercase ${
                  isTerminal
                    ? 'border-white/25 bg-black/70 text-stone-300'
                    : 'border-amber-500/35 bg-black/70 text-amber-200/75'
                }`}
              >
                AD
              </span>
              <div className="adsense-slot-wrapper relative flex h-[50px] max-h-[50px] min-h-[50px] flex-1 items-center justify-center overflow-hidden" />
            </div>
          </div>
        </div>
      )}

      <div className="flex min-w-0 flex-1 flex-row items-stretch">
        {!adRemoved && (
          <aside
            id="adsense-desktop-left"
            ref={leftGutterRef}
            style={{ display: desktopWide ? 'flex' : 'none', isolation: 'isolate' }}
            className={`adsense-gutter adsense-desktop-left relative z-0 w-[176px] shrink-0 select-none flex-col items-center justify-start border-r px-2 py-4 text-center ${gutterBg}`}
            aria-label="Google AdSense Left Wing"
          >
            <div className={`sticky top-4 w-[160px] overflow-hidden rounded-xl border p-1.5 ${cardBorder}`}>
              <div
                className={`mb-1 flex items-center justify-between border-b pb-1 text-[9px] font-bold tracking-wider uppercase ${
                  isTerminal ? 'border-white/15' : 'border-amber-500/20'
                } ${labelText}`}
              >
                <span>AD</span>
                <span>Google Ads</span>
              </div>
              <div className="adsense-slot-wrapper relative flex min-h-[600px] w-full items-center justify-center overflow-hidden" />
            </div>
          </aside>
        )}

        <div className="min-w-0 flex-1">{children}</div>

        {!adRemoved && (
          <aside
            id="adsense-desktop-right"
            ref={rightGutterRef}
            style={{ display: desktopWide ? 'flex' : 'none', isolation: 'isolate' }}
            className={`adsense-gutter adsense-desktop-right relative z-0 w-[176px] shrink-0 select-none flex-col items-center justify-start border-l px-2 py-4 text-center ${gutterBg}`}
            aria-label="Google AdSense Right Wing"
          >
            <div className={`sticky top-4 w-[160px] overflow-hidden rounded-xl border p-1.5 ${cardBorder}`}>
              <div
                className={`mb-1 flex items-center justify-between border-b pb-1 text-[9px] font-bold tracking-wider uppercase ${
                  isTerminal ? 'border-white/15' : 'border-amber-500/20'
                } ${labelText}`}
              >
                <span>AD</span>
                <span>Google Ads</span>
              </div>
              <div className="adsense-slot-wrapper relative flex min-h-[600px] w-full items-center justify-center overflow-hidden" />
            </div>
          </aside>
        )}
      </div>
    </div>
  );
};
