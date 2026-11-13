import { useEffect, useState } from 'react';

export type HeroLanguage = 'en' | 'ko';

export const HERO_LANG_STORAGE_KEY = 'hero_language';
export const HERO_LANG_EVENT = 'hero-language-change';

/**
 * Browser language detection:
 * - Only Korean browsers (`ko`, `ko-KR`, etc.) default to `'ko'`.
 * - Every other browser defaults to `'en'`.
 */
export function detectBrowserLanguage(): HeroLanguage {
  if (typeof navigator === 'undefined') return 'en';
  try {
    const primary =
      (Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages[0]
        : navigator.language) || '';
    if (primary.trim().toLowerCase().startsWith('ko')) {
      return 'ko';
    }
  } catch {
    // Fallback to English
  }
  return 'en';
}

export function getCurrentLanguage(): HeroLanguage {
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      const saved = localStorage.getItem(HERO_LANG_STORAGE_KEY);
      if (saved === 'ko' || saved === 'en') {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return detectBrowserLanguage();
}

export function setLanguage(lang: HeroLanguage): void {
  const normalized: HeroLanguage = lang === 'ko' ? 'ko' : 'en';
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    try {
      localStorage.setItem(HERO_LANG_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota errors
    }
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = normalized;
  }
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent(HERO_LANG_EVENT, { detail: normalized }));
  }
}

export function isKoreanLanguage(): boolean {
  return getCurrentLanguage() === 'ko';
}

/**
 * Translation helper compatible with reader tr(ko, en).
 */
export function tr(ko: string, en: string, _ja?: string): string {
  return getCurrentLanguage() === 'ko' ? ko : en;
}

/**
 * English-first helper t(en, ko).
 */
export function t(en: string, ko: string): string {
  return getCurrentLanguage() === 'ko' ? ko : en;
}

const langListeners = new Set<(lang: HeroLanguage) => void>();
let globalLangListenerAttached = false;

function ensureGlobalLangListener(): void {
  if (globalLangListenerAttached || typeof window === 'undefined') return;
  globalLangListenerAttached = true;
  const notifyAll = (explicit?: HeroLanguage) => {
    const resolved = explicit === 'ko' || explicit === 'en' ? explicit : getCurrentLanguage();
    langListeners.forEach((cb) => cb(resolved));
  };
  window.addEventListener(HERO_LANG_EVENT, (e: Event) => {
    notifyAll((e as CustomEvent<HeroLanguage>).detail);
  });
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === HERO_LANG_STORAGE_KEY) {
      notifyAll();
    }
  });
}

/**
 * React hook that subscribes to language changes from OptionsModal, Promo footer, or storage.
 * Uses a single module-level window listener so card-heavy screens avoid N*2 listener churn.
 */
export function useHeroLanguage(): {
  lang: HeroLanguage;
  isKo: boolean;
  setLang: (lang: HeroLanguage) => void;
  t: (en: string, ko: string) => string;
  tr: (ko: string, en: string) => string;
} {
  const [lang, setLangState] = useState<HeroLanguage>(() => getCurrentLanguage());

  useEffect(() => {
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = getCurrentLanguage();
    }
    ensureGlobalLangListener();
    langListeners.add(setLangState);
    return () => {
      langListeners.delete(setLangState);
    };
  }, []);

  const isKo = lang === 'ko';
  return {
    lang,
    isKo,
    setLang: setLanguage,
    t: (en: string, ko: string) => (isKo ? ko : en),
    tr: (ko: string, en: string) => (isKo ? ko : en),
  };
}
