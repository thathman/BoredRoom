/**
 * i18n setup.
 *
 * Locales:
 *   - en   — English (default fallback)
 *   - pcm  — Nigerian Pidgin / Naija English
 *
 * Detection order is configured by LanguageDetector: localStorage > navigator.
 * Switch language at runtime with i18n.changeLanguage('pcm') or via the
 * <LanguageSwitcher /> component (settings/profile screens).
 *
 * Translation depth note: this is a "shallow + targeted" pass. Lobby chrome,
 * GameOver, tutorials, controller turn labels, spotlight overlay, and replay
 * viewer are wrapped in t(). Per-game deep UI (e.g. trade modals, board
 * tooltips) intentionally stays English-only for now — keys live under
 * `controller.*` so individual games can opt-in incrementally.
 */
import i18n from 'i18next';
import { initReactI18next } from 'react-i18next';
import LanguageDetector from 'i18next-browser-languagedetector';
import en from './locales/en.json';
import pcm from './locales/pcm.json';

export const SUPPORTED_LANGUAGES = [
  { code: 'en', label: 'English' },
  { code: 'pcm', label: 'Pidgin / Naija English' },
] as const;

export type SupportedLanguage = typeof SUPPORTED_LANGUAGES[number]['code'];

void i18n
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { common: en },
      pcm: { common: pcm },
    },
    fallbackLng: 'en',
    supportedLngs: ['en', 'pcm'],
    defaultNS: 'common',
    interpolation: {
      escapeValue: false,
    },
    detection: {
      order: ['localStorage', 'navigator'],
      lookupLocalStorage: 'boredroom:lang',
      caches: ['localStorage'],
    },
    returnNull: false,
    returnObjects: true,
  });

export default i18n;
