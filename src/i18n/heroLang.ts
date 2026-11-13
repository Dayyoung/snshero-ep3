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

/**
 * React hook that subscribes to language changes from OptionsModal, Promo footer, or storage.
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
    const onCustom = (e: Event) => {
      const detail = (e as CustomEvent<HeroLanguage>).detail;
      if (detail === 'ko' || detail === 'en') {
        setLangState(detail);
      } else {
        setLangState(getCurrentLanguage());
      }
    };
    const onStorage = (e: StorageEvent) => {
      if (e.key === HERO_LANG_STORAGE_KEY) {
        setLangState(getCurrentLanguage());
      }
    };
    window.addEventListener(HERO_LANG_EVENT, onCustom);
    window.addEventListener('storage', onStorage);
    return () => {
      window.removeEventListener(HERO_LANG_EVENT, onCustom);
      window.removeEventListener('storage', onStorage);
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
