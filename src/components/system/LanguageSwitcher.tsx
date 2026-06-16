// Lightweight language switcher used in Profile + DisplayLobby footer.
// Reads supported languages from src/i18n; persists choice to localStorage
// via i18next-browser-languagedetector.

import { useTranslation } from 'react-i18next';
import { Languages } from 'lucide-react';
import { SUPPORTED_LANGUAGES } from '@/i18n';
import { trackEvent } from '@/lib/analytics';
import { toast } from 'sonner';

interface Props {
  className?: string;
  compact?: boolean;
}

export function LanguageSwitcher({ className = '', compact = false }: Props) {
  const { t, i18n } = useTranslation();
  const current = (i18n.resolvedLanguage ?? i18n.language ?? 'en').split('-')[0];

  const handleChange = (next: string) => {
    if (next === current) return;
    void i18n.changeLanguage(next).then(() => {
      trackEvent('lang_changed', { from: current, to: next });
      toast.success(t('settings.languageChanged'));
    });
  };

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      {!compact && (
        <span className="text-xs uppercase tracking-[0.25em] text-muted-foreground inline-flex items-center gap-1">
          <Languages className="w-3.5 h-3.5" /> {t('settings.language')}
        </span>
      )}
      <div role="radiogroup" aria-label={t('settings.language') as string} className="flex flex-wrap gap-1">
        {SUPPORTED_LANGUAGES.map((lang) => {
          const active = lang.code === current;
          return (
            <button
              key={lang.code}
              type="button"
              role="radio"
              aria-checked={active}
              onClick={() => handleChange(lang.code)}
              className={`px-3 py-1 rounded-full text-xs font-display border transition ${
                active
                  ? 'bg-primary text-primary-foreground border-primary'
                  : 'bg-background/50 text-foreground/80 border-border hover:bg-muted'
              }`}
            >
              {lang.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
