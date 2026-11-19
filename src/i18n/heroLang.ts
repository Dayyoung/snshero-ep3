import { useEffect, useState } from 'react';
import { translateDynamicPattern } from './dynamicPatterns';

export type HeroLanguage =
  | 'en'
  | 'ko'
  | 'ja'
  | 'zh-CN'
  | 'zh-TW'
  | 'es'
  | 'fr'
  | 'de'
  | 'pt'
  | 'ru';

export interface HeroLanguageMeta {
  code: HeroLanguage;
  nativeName: string;
  englishName: string;
  shortLabel: string;
  flag: string;
  speechLocale: string;
  htmlLang: string;
}

export const HERO_LANGUAGES: readonly HeroLanguageMeta[] = [
  {
    code: 'en',
    nativeName: 'English',
    englishName: 'English',
    shortLabel: 'EN',
    flag: '🇺🇸',
    speechLocale: 'en-US',
    htmlLang: 'en',
  },
  {
    code: 'ko',
    nativeName: '한국어',
    englishName: 'Korean',
    shortLabel: 'KO',
    flag: '🇰🇷',
    speechLocale: 'ko-KR',
    htmlLang: 'ko',
  },
  {
    code: 'ja',
    nativeName: '日本語',
    englishName: 'Japanese',
    shortLabel: 'JA',
    flag: '🇯🇵',
    speechLocale: 'ja-JP',
    htmlLang: 'ja',
  },
  {
    code: 'zh-CN',
    nativeName: '简体中文',
    englishName: 'Chinese (Simplified)',
    shortLabel: '简中',
    flag: '🇨🇳',
    speechLocale: 'zh-CN',
    htmlLang: 'zh-CN',
  },
  {
    code: 'zh-TW',
    nativeName: '繁體中文',
    englishName: 'Chinese (Traditional)',
    shortLabel: '繁中',
    flag: '🇹🇼',
    speechLocale: 'zh-TW',
    htmlLang: 'zh-TW',
  },
  {
    code: 'es',
    nativeName: 'Español',
    englishName: 'Spanish',
    shortLabel: 'ES',
    flag: '🇪🇸',
    speechLocale: 'es-ES',
    htmlLang: 'es',
  },
  {
    code: 'fr',
    nativeName: 'Français',
    englishName: 'French',
    shortLabel: 'FR',
    flag: '🇫🇷',
    speechLocale: 'fr-FR',
    htmlLang: 'fr',
  },
  {
    code: 'de',
    nativeName: 'Deutsch',
    englishName: 'German',
    shortLabel: 'DE',
    flag: '🇩🇪',
    speechLocale: 'de-DE',
    htmlLang: 'de',
  },
  {
    code: 'pt',
    nativeName: 'Português',
    englishName: 'Portuguese',
    shortLabel: 'PT',
    flag: '🇧🇷',
    speechLocale: 'pt-BR',
    htmlLang: 'pt',
  },
  {
    code: 'ru',
    nativeName: 'Русский',
    englishName: 'Russian',
    shortLabel: 'RU',
    flag: '🇷🇺',
    speechLocale: 'ru-RU',
    htmlLang: 'ru',
  },
] as const;

export const HERO_LANGUAGE_CODES: readonly HeroLanguage[] = HERO_LANGUAGES.map((l) => l.code);

export const HERO_LANG_STORAGE_KEY = 'hero_language';
export const HERO_LANG_EVENT = 'hero-language-change';
export const HERO_LOCALE_READY_EVENT = 'hero-locale-ready';

export function getLanguageMeta(lang: HeroLanguage): HeroLanguageMeta {
  return HERO_LANGUAGES.find((item) => item.code === lang) || HERO_LANGUAGES[0];
}

export function getSpeechLocale(lang?: HeroLanguage): string {
  return getLanguageMeta(lang || getCurrentLanguage()).speechLocale;
}

/**
 * Normalize any BCP-47 tag, URL param, or saved value into a supported HeroLanguage.
 */
export function normalizeHeroLanguage(raw?: string | null): HeroLanguage | null {
  if (!raw || typeof raw !== 'string') return null;
  const cleaned = raw.trim().replace(/_/g, '-').toLowerCase();
  if (!cleaned) return null;

  if (cleaned === 'ko' || cleaned.startsWith('ko-')) return 'ko';
  if (cleaned === 'en' || cleaned.startsWith('en-')) return 'en';
  if (cleaned === 'ja' || cleaned.startsWith('ja-') || cleaned === 'jp') return 'ja';
  if (
    cleaned === 'zh-tw' ||
    cleaned === 'zh-hk' ||
    cleaned === 'zh-mo' ||
    cleaned.startsWith('zh-hant')
  ) {
    return 'zh-TW';
  }
  if (cleaned === 'zh' || cleaned.startsWith('zh-')) return 'zh-CN';
  if (cleaned === 'es' || cleaned.startsWith('es-')) return 'es';
  if (cleaned === 'fr' || cleaned.startsWith('fr-')) return 'fr';
  if (cleaned === 'de' || cleaned.startsWith('de-')) return 'de';
  if (cleaned === 'pt' || cleaned.startsWith('pt-')) return 'pt';
  if (cleaned === 'ru' || cleaned.startsWith('ru-')) return 'ru';

  return null;
}

/**
 * Browser language detection:
 * Checks navigator.languages in preference order and returns the first supported HeroLanguage.
 * Falls back to `'en'` when no supported language matches.
 */
export function detectBrowserLanguage(): HeroLanguage {
  if (typeof navigator === 'undefined') return 'en';
  try {
    const candidates =
      Array.isArray(navigator.languages) && navigator.languages.length > 0
        ? navigator.languages
        : navigator.language
          ? [navigator.language]
          : [];
    for (const candidate of candidates) {
      const normalized = normalizeHeroLanguage(candidate);
      if (normalized) return normalized;
    }
  } catch {
    // Fallback to English
  }
  return 'en';
}

// ---------------------------------------------------------------------------
// On-demand locale dictionary loader (code-split per language via Vite)
// ---------------------------------------------------------------------------
type LocaleDictionary = Record<string, string>;
const loadedDictionaries: Partial<Record<HeroLanguage, LocaleDictionary>> = {};
const loadingPromises: Partial<Record<HeroLanguage, Promise<void>>> = {};
let localeRevision = 0;

function importLocaleChunk(lang: HeroLanguage): Promise<LocaleDictionary | null> {
  switch (lang) {
    case 'ja':
      return import('./locales/ja').then((m) => m.default);
    case 'zh-CN':
      return import('./locales/zh-CN').then((m) => m.default);
    case 'zh-TW':
      return import('./locales/zh-TW').then((m) => m.default);
    case 'es':
      return import('./locales/es').then((m) => m.default);
    case 'fr':
      return import('./locales/fr').then((m) => m.default);
    case 'de':
      return import('./locales/de').then((m) => m.default);
    case 'pt':
      return import('./locales/pt').then((m) => m.default);
    case 'ru':
      return import('./locales/ru').then((m) => m.default);
    default:
      return Promise.resolve(null);
  }
}

export function isLocaleLoaded(lang: HeroLanguage): boolean {
  if (lang === 'en' || lang === 'ko') return true;
  return Boolean(loadedDictionaries[lang]);
}

export function ensureLocaleLoaded(lang: HeroLanguage): Promise<void> {
  if (lang === 'en' || lang === 'ko' || loadedDictionaries[lang]) {
    return Promise.resolve();
  }
  const existing = loadingPromises[lang];
  if (existing) return existing;

  const promise = importLocaleChunk(lang)
    .then((dict) => {
      if (dict) {
        loadedDictionaries[lang] = dict;
        localeRevision += 1;
        notifyAllListeners(getCurrentLanguage());
        if (typeof window !== 'undefined') {
          window.dispatchEvent(new CustomEvent(HERO_LOCALE_READY_EVENT, { detail: lang }));
        }
      }
    })
    .catch(() => {
      // Keep English fallback safely if chunk load fails
    })
    .finally(() => {
      delete loadingPromises[lang];
    });

  loadingPromises[lang] = promise;
  return promise;
}

export function getCurrentLanguage(): HeroLanguage {
  if (typeof window !== 'undefined' && window.location?.search) {
    try {
      const urlLang = normalizeHeroLanguage(new URLSearchParams(window.location.search).get('lang'));
      if (urlLang) {
        return urlLang;
      }
    } catch {
      // Ignore URL parse error
    }
  }
  if (typeof window !== 'undefined' && window.location?.pathname) {
    const seg = window.location.pathname.split('/').filter(Boolean)[0];
    if (seg) {
      const pathLang = normalizeHeroLanguage(seg);
      // Avoid matching non-locale top-level routes
      if (pathLang && ['en', 'ko', 'ja', 'zh-cn', 'zh-tw', 'es', 'fr', 'de', 'pt', 'ru'].includes(seg.toLowerCase())) {
        return pathLang;
      }
    }
  }
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      const saved = normalizeHeroLanguage(localStorage.getItem(HERO_LANG_STORAGE_KEY));
      if (saved) {
        return saved;
      }
    } catch {
      // Ignore storage access errors
    }
  }
  return detectBrowserLanguage();
}

export function setLanguage(lang: HeroLanguage): void {
  const normalized: HeroLanguage = normalizeHeroLanguage(lang) || 'en';
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    try {
      localStorage.setItem(HERO_LANG_STORAGE_KEY, normalized);
    } catch {
      // Ignore storage quota errors
    }
  }
  if (typeof document !== 'undefined' && document.documentElement) {
    document.documentElement.lang = getLanguageMeta(normalized).htmlLang;
  }
  if (typeof window !== 'undefined') {
    try {
      const url = new URL(window.location.href);
      url.searchParams.set('lang', normalized);
      window.history.replaceState(window.history.state, '', url.toString());
    } catch {
      // Ignore URL replace error
    }
    window.dispatchEvent(new CustomEvent(HERO_LANG_EVENT, { detail: normalized }));
  }
  // Trigger async locale chunk load if needed (notifies listeners again once ready)
  void ensureLocaleLoaded(normalized);
}

export function isKoreanLanguage(): boolean {
  return getCurrentLanguage() === 'ko';
}

function lookupLocalizedText(en: string, ko: string, lang: HeroLanguage, ja?: string): string {
  if (lang === 'ko') return ko;
  if (lang === 'en') return en;
  if (lang === 'ja' && ja) return ja;

  const dict = loadedDictionaries[lang];
  if (dict) {
    const exact = dict[en];
    if (exact !== undefined) return exact;

    // Try trimmed match while preserving outer whitespace
    const trimmed = en.trim();
    if (trimmed && trimmed !== en && dict[trimmed] !== undefined) {
      const lead = en.slice(0, en.indexOf(trimmed));
      const trail = en.slice(en.indexOf(trimmed) + trimmed.length);
      return `${lead}${dict[trimmed]}${trail}`;
    }
  } else {
    // Ensure chunk load starts even if called outside React hook
    void ensureLocaleLoaded(lang);
  }

  const dynamic = translateDynamicPattern(en, lang);
  if (dynamic !== null) return dynamic;

  return en;
}

/**
 * Translation helper compatible with reader tr(ko, en).
 * Automatically resolves all 10 supported languages via locale dictionaries & dynamic patterns.
 */
export function tr(ko: string, en: string, ja?: string): string {
  return lookupLocalizedText(en, ko, getCurrentLanguage(), ja);
}

/**
 * English-first helper t(en, ko).
 */
export function t(en: string, ko: string): string {
  return lookupLocalizedText(en, ko, getCurrentLanguage());
}

type LangListener = (state: { lang: HeroLanguage; rev: number }) => void;
const langListeners = new Set<LangListener>();
let globalLangListenerAttached = false;

function notifyAllListeners(explicit?: HeroLanguage): void {
  const resolved = (explicit && normalizeHeroLanguage(explicit)) || getCurrentLanguage();
  const next = { lang: resolved, rev: localeRevision };
  langListeners.forEach((cb) => cb(next));
}

function ensureGlobalLangListener(): void {
  if (globalLangListenerAttached || typeof window === 'undefined') return;
  globalLangListenerAttached = true;
  window.addEventListener(HERO_LANG_EVENT, (e: Event) => {
    notifyAllListeners((e as CustomEvent<HeroLanguage>).detail);
  });
  window.addEventListener('storage', (e: StorageEvent) => {
    if (e.key === HERO_LANG_STORAGE_KEY) {
      const next = getCurrentLanguage();
      void ensureLocaleLoaded(next);
      notifyAllListeners(next);
    }
  });
}

// Kick off initial locale load immediately on module evaluation if non-base language is active
if (typeof window !== 'undefined') {
  const initialLang = getCurrentLanguage();
  if (initialLang !== 'en' && initialLang !== 'ko') {
    void ensureLocaleLoaded(initialLang);
  }
}

/**
 * React hook that subscribes to language changes and async locale pack loads.
 * Uses a single module-level window listener so card-heavy screens avoid N*2 listener churn.
 */
export function useHeroLanguage(): {
  lang: HeroLanguage;
  isKo: boolean;
  setLang: (lang: HeroLanguage) => void;
  t: (en: string, ko: string) => string;
  tr: (ko: string, en: string, ja?: string) => string;
} {
  const [state, setState] = useState<{ lang: HeroLanguage; rev: number }>(() => ({
    lang: getCurrentLanguage(),
    rev: localeRevision,
  }));

  useEffect(() => {
    const current = getCurrentLanguage();
    if (typeof document !== 'undefined' && document.documentElement) {
      document.documentElement.lang = getLanguageMeta(current).htmlLang;
    }
    ensureGlobalLangListener();
    langListeners.add(setState);
    if (!isLocaleLoaded(current)) {
      void ensureLocaleLoaded(current);
    }
    return () => {
      langListeners.delete(setState);
    };
  }, []);

  const { lang } = state;
  const isKo = lang === 'ko';
  return {
    lang,
    isKo,
    setLang: setLanguage,
    t: (en: string, ko: string) => lookupLocalizedText(en, ko, lang),
    tr: (ko: string, en: string, ja?: string) => lookupLocalizedText(en, ko, lang, ja),
  };
}
