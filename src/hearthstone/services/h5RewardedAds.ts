/**
 * Google AdSense H5 Games Ads — Official Ad Placement API Rewarded Wrapper
 *
 * Strictly complies with Google Ad Placement API (`type: 'reward'`) and Publisher Rewarded Policies:
 *   1. Explicitly calls `beforeReward(showAdFn)` so the user triggers an opt-in confirmation prompt before playback.
 *   2. Grants non-monetary, non-transferable in-game Gold (+50G) ONLY when `adViewed()` fires.
 *   3. Never grants rewards on `adDismissed()` or unavailable/error `adBreakDone()` states.
 *   4. Suspends game audio on `beforeAd` and restores it cleanly on `afterAd` / `adBreakDone`.
 */

import { hsAudio } from '../audio';
import { hsStorage, RewardedAdQuotaStatus } from '../storage';

export type H5BreakStatus =
  | 'notReady'
  | 'timeout'
  | 'invalid'
  | 'error'
  | 'noAdPreloaded'
  | 'frequencyCapped'
  | 'ignored'
  | 'other'
  | 'dismissed'
  | 'viewed';

export interface H5AdPlacementInfo {
  breakType: 'preroll' | 'start' | 'pause' | 'next' | 'browse' | 'reward';
  breakName?: string;
  breakFormat?: 'interstitial' | 'reward';
  breakStatus: H5BreakStatus;
}

export interface H5AdConfigOptions {
  preloadAdBreaks?: 'on' | 'auto';
  sound?: 'on' | 'off';
  onReady?: () => void;
}

export interface H5AdBreakOptions {
  type: 'preroll' | 'start' | 'pause' | 'next' | 'browse' | 'reward';
  name?: string;
  beforeAd?: () => void;
  afterAd?: () => void;
  beforeReward?: (showAdFn: () => void) => void;
  adDismissed?: () => void;
  adViewed?: () => void;
  adBreakDone?: (placementInfo: H5AdPlacementInfo) => void;
}

declare global {
  interface Window {
    adsbygoogle?: unknown[];
    adBreak?: (opts: H5AdBreakOptions) => void;
    adConfig?: (opts: H5AdConfigOptions) => void;
  }
}

let h5PreloadInitialized = false;
const H5_AD_ACTIVE_CLASS = 'snshero-h5-ad-active';

function setH5AdActive(active: boolean): void {
  if (typeof document === 'undefined' || !document.body) return;
  document.body.classList.toggle(H5_AD_ACTIVE_CLASS, active);
}

/**
 * Ensures Google Ad Placement API global queue shims exist on window.
 */
function ensureAdPlacementGlobals(): boolean {
  if (typeof window === 'undefined') return false;
  window.adsbygoogle = window.adsbygoogle || [];
  if (typeof window.adConfig !== 'function' || typeof window.adBreak !== 'function') {
    const queuePush = (o: unknown) => {
      window.adsbygoogle = window.adsbygoogle || [];
      window.adsbygoogle.push(o);
    };
    if (typeof window.adConfig !== 'function') window.adConfig = queuePush as (o: H5AdConfigOptions) => void;
    if (typeof window.adBreak !== 'function') window.adBreak = queuePush as (o: H5AdBreakOptions) => void;
  }
  return true;
}

/**
 * Configures H5 Games Ad Placement API once per session (`preloadAdBreaks: 'on'` may only be set once).
 */
export function initH5GamesAds(soundOn: boolean): void {
  if (!ensureAdPlacementGlobals() || typeof window.adConfig !== 'function') return;
  if (!h5PreloadInitialized) {
    h5PreloadInitialized = true;
    try {
      window.adConfig({
        preloadAdBreaks: 'on',
        sound: soundOn ? 'on' : 'off',
      });
    } catch {
      // ignore script load failure
    }
    return;
  }
  syncH5AdSound(soundOn);
}

/**
 * Synchronizes current game mute preference with H5 Ad Placement API sound configuration.
 */
export function syncH5AdSound(soundOn: boolean): void {
  if (typeof window === 'undefined' || typeof window.adConfig !== 'function') return;
  try {
    window.adConfig({ sound: soundOn ? 'on' : 'off' });
  } catch {
    // ignore
  }
}

export interface RewardedGoldCallbacks {
  onBeforeRewardPrompt: (showAdFn: () => void, cancelPrompt: () => void) => void;
  onAdShowing?: () => void;
  onRewardGranted: (goldAdded: number, newGold: number, quota: RewardedAdQuotaStatus) => void;
  onDismissed: () => void;
  onUnavailable: (breakStatus: H5BreakStatus | 'adblocker_timeout' | 'quota_limit') => void;
}

/**
 * Initiates a Google AdSense H5 Games rewarded ad request (`type: 'reward'`).
 * Never simulates rewards when the script or Google H5 Games inventory is unavailable.
 */
export function requestRewardedGoldAd(callbacks: RewardedGoldCallbacks): void {
  const quota = hsStorage.getRewardedAdQuotaStatus();
  if (quota.remainingToday <= 0 || quota.cooldownSecondsLeft > 0) {
    callbacks.onUnavailable('quota_limit');
    return;
  }

  if (!ensureAdPlacementGlobals() || typeof window.adBreak !== 'function') {
    callbacks.onUnavailable('notReady');
    return;
  }

  let settled = false;
  let audioSuspended = false;

  const restoreAudioIfSuspended = () => {
    if (audioSuspended) {
      audioSuspended = false;
      hsAudio.resumeAfterAd();
    }
  };

  // Recover gracefully if adblocker or unapproved H5 Games domain prevents Google callbacks within 6.5s
  const safetyTimer = window.setTimeout(() => {
    if (settled) return;
    settled = true;
    setH5AdActive(false);
    restoreAudioIfSuspended();
    callbacks.onUnavailable('adblocker_timeout');
  }, 6500);

  const clearSafetyTimer = () => {
    window.clearTimeout(safetyTimer);
  };

  try {
    window.adBreak({
      type: 'reward',
      name: 'shop_gold_recharge',
      beforeAd: () => {
        clearSafetyTimer();
        setH5AdActive(true);
        audioSuspended = true;
        hsAudio.suspendForAd();
        callbacks.onAdShowing?.();
      },
      afterAd: () => {
        setH5AdActive(false);
        restoreAudioIfSuspended();
      },
      beforeReward: (showAdFn) => {
        clearSafetyTimer();
        if (settled) return;
        const wrappedShow = () => {
          if (settled) return;
          setH5AdActive(true);
          callbacks.onAdShowing?.();
          try {
            showAdFn();
          } catch {
            settled = true;
            setH5AdActive(false);
            restoreAudioIfSuspended();
            callbacks.onUnavailable('error');
          }
        };
        const cancelPrompt = () => {
          if (settled) return;
          settled = true;
          setH5AdActive(false);
          callbacks.onDismissed();
        };
        callbacks.onBeforeRewardPrompt(wrappedShow, cancelPrompt);
      },
      adViewed: () => {
        clearSafetyTimer();
        setH5AdActive(false);
        restoreAudioIfSuspended();
        if (settled) return;
        settled = true;
        const result = hsStorage.claimRewardedAdGold();
        if (result.ok) {
          callbacks.onRewardGranted(result.goldAdded, result.newGold, result.quota);
        } else {
          callbacks.onUnavailable('quota_limit');
        }
      },
      adDismissed: () => {
        clearSafetyTimer();
        setH5AdActive(false);
        restoreAudioIfSuspended();
        if (settled) return;
        settled = true;
        callbacks.onDismissed();
      },
      adBreakDone: (placementInfo) => {
        clearSafetyTimer();
        setH5AdActive(false);
        restoreAudioIfSuspended();
        if (settled) return;
        settled = true;
        const status = placementInfo?.breakStatus || 'other';
        if (status === 'dismissed' || status === 'ignored') {
          callbacks.onDismissed();
        } else if (status !== 'viewed') {
          callbacks.onUnavailable(status);
        }
      },
    });
  } catch {
    clearSafetyTimer();
    setH5AdActive(false);
    restoreAudioIfSuspended();
    if (!settled) {
      settled = true;
      callbacks.onUnavailable('error');
    }
  }
}
