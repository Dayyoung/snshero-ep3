/**
 * HTML5 Web Game Portal Bridge (CrazyGames SDK v2/v3 & itch.io compliance).
 * Safely suppresses external AdSense banners inside portal iframes and dispatches
 * CrazyGames lifecycle events (`gameplayStart`, `gameplayStop`, `happytime`).
 */

export type PortalPlatform = 'crazygames' | 'itchio' | 'web';

declare global {
  interface Window {
    __SNSHERO_PORTAL__?: PortalPlatform;
    CrazyGames?: {
      SDK?: {
        game?: {
          gameplayStart?: () => void;
          gameplayStop?: () => void;
          happytime?: () => void;
        };
      };
    };
  }
}

export function detectPortalPlatform(): PortalPlatform {
  if (typeof window === 'undefined') return 'web';
  if (window.__SNSHERO_PORTAL__ === 'crazygames' || window.__SNSHERO_PORTAL__ === 'itchio') {
    return window.__SNSHERO_PORTAL__;
  }
  try {
    const q = new URLSearchParams(window.location.search).get('portal')?.toLowerCase();
    if (q === 'crazygames') return 'crazygames';
    if (q === 'itchio' || q === 'itch') return 'itchio';
    const host = (window.location.hostname || '').toLowerCase();
    if (host.includes('crazygames.') || host.includes('1001juegos.')) return 'crazygames';
    if (host.includes('itch.zone') || host.includes('itch.io') || host.includes('hwcdn.net')) {
      return 'itchio';
    }
  } catch {
    // ignore URL/host parsing issues
  }
  return 'web';
}

export function isPortalNoAdsEnvironment(): boolean {
  const p = detectPortalPlatform();
  return p === 'crazygames' || p === 'itchio';
}

/**
 * Detects whether the game is running inside an external portal iframe (e.g. itch.io wrapper)
 * where gently prompting players to continue on the main SNSHero.com site is policy-compliant.
 * Always returns null on CrazyGames to strictly comply with CrazyGames external-link guidelines.
 */
export function detectEmbedSource(): 'itchio' | 'portal' | null {
  if (typeof window === 'undefined') return null;
  if (detectPortalPlatform() === 'crazygames') return null;
  try {
    const params = new URLSearchParams(window.location.search);
    const embed = (params.get('embed') || '').toLowerCase();
    if (embed === 'itchio' || embed === 'itch') return 'itchio';
    if (embed === 'portal' || embed === 'iframe') return 'portal';
    if (window.self !== window.top) {
      const ref = (document.referrer || '').toLowerCase();
      if (ref.includes('crazygames.') || ref.includes('1001juegos.') || ref.includes('poki.')) {
        return null;
      }
      if (ref.includes('itch.io') || ref.includes('itch.zone') || ref.includes('hwcdn.net')) {
        return 'itchio';
      }
      if (ref && !ref.includes('snshero.com') && !ref.includes('localhost') && !ref.includes('127.0.0.1')) {
        return 'portal';
      }
    }
  } catch {
    return null;
  }
  return null;
}

export function getFullSiteLaunchUrl(source: string, lang: string): string {
  const safeLang = encodeURIComponent(lang || 'en');
  const safeSrc = encodeURIComponent(source || 'itchio');
  return `https://snshero.com/game?lang=${safeLang}&from=${safeSrc}&utm_source=${safeSrc}&utm_medium=iframe_cta`;
}

export function portalGameplayStart(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CrazyGames?.SDK?.game?.gameplayStart?.();
  } catch {
    // no-op outside CrazyGames
  }
}

export function portalGameplayStop(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CrazyGames?.SDK?.game?.gameplayStop?.();
  } catch {
    // no-op outside CrazyGames
  }
}

export function portalHappyTime(): void {
  if (typeof window === 'undefined') return;
  try {
    window.CrazyGames?.SDK?.game?.happytime?.();
  } catch {
    // no-op outside CrazyGames
  }
}
