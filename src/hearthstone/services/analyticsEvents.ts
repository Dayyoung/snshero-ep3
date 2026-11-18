/**
 * SNSHero GA4 & Google Ads Funnel Analytics Helper
 *
 * Emits clean, privacy-safe GA4 funnel events (`hero_first_pack_opened`,
 * `hero_first_battle_started`, `hero_battle_started`, `hero_battle_won`,
 * `hero_rewarded_ad_completed`, `hero_shop_checkout_started`, `hero_promo_cta_click`)
 * for importing as Google Ads Primary Conversions (`G-MT60DTV1KJ`).
 */

const FIRST_PACK_SENT_KEY = 'hero_hs_ga_first_pack_sent';
const FIRST_BATTLE_SENT_KEY = 'hero_hs_ga_first_battle_sent';

const ATTRIBUTION_PARAMS = [
  'utm_source',
  'utm_medium',
  'utm_campaign',
  'utm_term',
  'utm_content',
  'gclid',
  'gbraid',
  'wbraid',
  'lang',
] as const;

export interface TrackedEventRecord {
  name: string;
  params: Record<string, string | number | boolean>;
  timestamp: number;
}

declare global {
  interface Window {
    gtag?: (...args: unknown[]) => void;
    __heroTrackedEvents?: TrackedEventRecord[];
  }
}

function shouldSendLiveGtag(): boolean {
  if (typeof window === 'undefined') return false;
  const isLocalHost = /^(localhost|127\.0\.0\.1|.*\.ts\.net)$/i.test(window.location.hostname);
  const debugEnabled = /[?&]ga_debug=1\b/.test(window.location.search);
  return !isLocalHost || debugEnabled;
}

export function trackHeroEvent(
  name: string,
  params: Record<string, string | number | boolean> = {},
): void {
  if (typeof window === 'undefined') return;
  try {
    window.__heroTrackedEvents = window.__heroTrackedEvents || [];
    window.__heroTrackedEvents.push({
      name,
      params,
      timestamp: Date.now(),
    });
    if (window.__heroTrackedEvents.length > 50) {
      window.__heroTrackedEvents.shift();
    }
  } catch {
    // ignore debug buffer errors
  }

  if (!shouldSendLiveGtag()) return;
  if (typeof window.gtag === 'function') {
    window.gtag('event', name, params);
  }
}

export function trackHeroScreenView(screenName: string): void {
  if (typeof window === 'undefined') return;
  if (!shouldSendLiveGtag()) return;
  if (typeof window.gtag === 'function') {
    window.gtag('event', 'screen_view', {
      app_name: 'SNSHero',
      screen_name: screenName,
    });
  }
}

export function trackHeroPackOpened(opts: {
  totalPacksOpened: number;
  journeyReinforcement: boolean;
}): void {
  trackHeroEvent('hero_pack_opened', {
    packs_opened_total: opts.totalPacksOpened,
    journey_reinforcement: opts.journeyReinforcement,
  });

  try {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(FIRST_PACK_SENT_KEY)) {
      localStorage.setItem(FIRST_PACK_SENT_KEY, '1');
      trackHeroEvent('hero_first_pack_opened', {
        packs_opened_total: opts.totalPacksOpened,
      });
    }
  } catch {
    // ignore storage errors
  }
}

export function trackHeroBattleStarted(opts: {
  mode: string;
  episode?: number;
}): void {
  trackHeroEvent('hero_battle_started', {
    battle_mode: opts.mode,
    episode: opts.episode ?? 0,
  });

  try {
    if (typeof localStorage !== 'undefined' && !localStorage.getItem(FIRST_BATTLE_SENT_KEY)) {
      localStorage.setItem(FIRST_BATTLE_SENT_KEY, '1');
      trackHeroEvent('hero_first_battle_started', {
        battle_mode: opts.mode,
        episode: opts.episode ?? 0,
      });
    }
  } catch {
    // ignore storage errors
  }
}

export function trackHeroBattleCompleted(opts: {
  mode: string;
  didWin: boolean;
  episode?: number;
  turnCount: number;
}): void {
  trackHeroEvent(opts.didWin ? 'hero_battle_won' : 'hero_battle_lost', {
    battle_mode: opts.mode,
    episode: opts.episode ?? 0,
    turn_count: opts.turnCount,
  });
}

export function trackHeroRewardedAdCompleted(goldAdded: number): void {
  trackHeroEvent('hero_rewarded_ad_completed', {
    reward_amount: goldAdded,
    currency: 'GOLD',
  });
}

/**
 * Preserves current ad click attribution (`gclid`, `utm_*`, `lang`) when navigating from `/` to `/game`.
 */
export function appendAttributionToGameUrl(baseHref: string): string {
  if (typeof window === 'undefined') return baseHref;
  try {
    const curParams = new URLSearchParams(window.location.search);
    const dest = new URL(baseHref, window.location.origin);
    for (const key of ATTRIBUTION_PARAMS) {
      const val = curParams.get(key);
      if (val && !dest.searchParams.has(key)) {
        dest.searchParams.set(key, val);
      }
    }
    return `${dest.pathname}${dest.search}${dest.hash}`;
  } catch {
    return baseHref;
  }
}
