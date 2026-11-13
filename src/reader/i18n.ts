export type SupportedLanguage = 'ko' | 'en' | 'ja';

export const SUPPORTED_LANGUAGES: readonly SupportedLanguage[] = ['ko', 'en', 'ja'] as const;

let memoryLanguage: SupportedLanguage = 'ko';

export function getCurrentLanguage(): SupportedLanguage {
  if (typeof localStorage !== 'undefined' && typeof localStorage.getItem === 'function') {
    const saved = localStorage.getItem('hero_language') as SupportedLanguage | null;
    if (saved && (SUPPORTED_LANGUAGES as readonly string[]).includes(saved)) {
      memoryLanguage = saved;
      return saved;
    }
    if (saved) return 'en';
  }
  return memoryLanguage;
}

export function setLanguage(lang: SupportedLanguage): void {
  memoryLanguage = lang;
  if (typeof localStorage !== 'undefined' && typeof localStorage.setItem === 'function') {
    try {
      localStorage.setItem('hero_language', lang);
    } catch {
      // Ignore storage quota errors
    }
  }
}

export function isKoreanLanguage(): boolean {
  return getCurrentLanguage() === 'ko';
}

export function tr(ko: string, en: string, ja?: string): string {
  const lang = getCurrentLanguage();
  if (lang === 'ko') return ko;
  if (lang === 'ja' && ja) return ja;
  return en;
}
