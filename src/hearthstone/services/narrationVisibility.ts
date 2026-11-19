import { useEffect, useSyncExternalStore } from 'react';

let activeNarrationCount = 0;
const listeners = new Set<() => void>();

function notify() {
  for (const fn of listeners) {
    fn();
  }
}

export function registerNarrationOverlay(): () => void {
  activeNarrationCount += 1;
  notify();
  let released = false;
  return () => {
    if (released) return;
    released = true;
    activeNarrationCount = Math.max(0, activeNarrationCount - 1);
    notify();
  };
}

function subscribe(cb: () => void): () => void {
  listeners.add(cb);
  return () => {
    listeners.delete(cb);
  };
}

function getSnapshot(): boolean {
  return activeNarrationCount > 0;
}

/**
 * Call inside any narration / story dialogue / cutscene overlay to temporarily
 * hide floating corner widgets (Kadan Chatbot & Live Community Chat).
 */
export function useRegisterNarrationOverlay(active = true) {
  useEffect(() => {
    if (!active) return;
    return registerNarrationOverlay();
  }, [active]);
}

/**
 * Returns `true` whenever any story narration / boss dialogue / Bogart narration
 * overlay is currently visible on screen.
 */
export function useIsNarrationActive(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
}
