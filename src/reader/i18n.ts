export type { HeroLanguage as SupportedLanguage } from '../i18n/heroLang';
export const SUPPORTED_LANGUAGES = ['en', 'ko'] as const;
export {
  detectBrowserLanguage,
  getCurrentLanguage,
  setLanguage,
  isKoreanLanguage,
  tr,
  t,
} from '../i18n/heroLang';
