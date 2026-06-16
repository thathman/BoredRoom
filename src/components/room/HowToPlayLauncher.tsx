/**
 * "How to play" — interactive stepper with Next/Back/Skip + analytics + i18n.
 *
 * Tutorial copy is sourced from `src/i18n/locales/<lang>.json` under
 * `tutorial.tutorials.<slug>`. Uses i18n's returnObjects: true to read the
 * steps array.
 *
 * One-shot per slug per device — open state persists in localStorage.
 * Re-openable via the small launcher button.
 *
 * Analytics emitted via trackEvent:
 *   - tutorial_opened   { slug, autoOpened }
 *   - tutorial_step     { slug, step, total }
 *   - tutorial_skipped  { slug, atStep, total }
 *   - tutorial_completed{ slug, total }
 */
import { useEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { BookOpen, ArrowLeft, ArrowRight, Check, X } from 'lucide-react';
import { trackEvent } from '@/lib/analytics';

interface TutorialStep {
  title: string;
  body: string;
}

interface TutorialResource {
  title: string;
  steps: TutorialStep[];
}

const SUPPORTED = new Set(['hustle', 'word-wahala', 'landlord', 'connect-4', 'ettt']);

function storageKey(slug: string) {
  return `boredroom:tutorial-seen:${slug}`;
}

interface Props {
  gameSlug: string;
}

export function HowToPlayLauncher({ gameSlug }: Props) {
  const { t, i18n } = useTranslation();
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [autoOpened, setAutoOpened] = useState(false);
  const supported = SUPPORTED.has(gameSlug);

  // Resolve the tutorial copy from the active locale; fallback safely.
  const resource = supported
    ? (t(`tutorial.tutorials.${gameSlug}`, { returnObjects: true, defaultValue: null }) as TutorialResource | null)
    : null;
  const steps: TutorialStep[] = resource?.steps ?? [];
  const total = steps.length;

  useEffect(() => {
    if (!supported) return;
    try {
      const seen = localStorage.getItem(storageKey(gameSlug));
      if (!seen) {
        setOpen(true);
        setAutoOpened(true);
        trackEvent('tutorial_opened', { slug: gameSlug, autoOpened: true });
      }
    } catch {
      // ignore
    }
    // re-run if user changes language so we resolve the latest steps copy
  }, [gameSlug, supported, i18n.resolvedLanguage]);

  if (!supported || !resource || total === 0) return null;

  const markSeen = () => {
    try {
      localStorage.setItem(storageKey(gameSlug), '1');
    } catch {
      // ignore
    }
  };

  const handleClose = (next: boolean) => {
    if (!next) {
      // Closing: count as skip if not finished, complete if at last step.
      if (step >= total - 1) {
        trackEvent('tutorial_completed', { slug: gameSlug, total });
      } else {
        trackEvent('tutorial_skipped', { slug: gameSlug, atStep: step, total });
      }
      markSeen();
      setStep(0);
    }
    setOpen(next);
    if (next && !autoOpened) {
      trackEvent('tutorial_opened', { slug: gameSlug, autoOpened: false });
    }
  };

  const goNext = () => {
    if (step < total - 1) {
      const newStep = step + 1;
      setStep(newStep);
      trackEvent('tutorial_step', { slug: gameSlug, step: newStep, total });
    } else {
      handleClose(false);
    }
  };

  const goBack = () => {
    if (step > 0) setStep(step - 1);
  };

  const handleSkip = () => {
    trackEvent('tutorial_skipped', { slug: gameSlug, atStep: step, total, viaButton: true });
    markSeen();
    setStep(0);
    setOpen(false);
  };

  const current = steps[step];

  return (
    <>
      <Button
        type="button"
        variant="ghost"
        size="sm"
        className="gap-2"
        onClick={() => {
          setAutoOpened(false);
          setStep(0);
          setOpen(true);
          trackEvent('tutorial_opened', { slug: gameSlug, autoOpened: false });
        }}
      >
        <BookOpen className="w-4 h-4" />
        {t('tutorial.openButton')}
      </Button>

      <Dialog open={open} onOpenChange={handleClose}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle className="font-display text-2xl">{resource.title}</DialogTitle>
            <DialogDescription>
              {t('tutorial.subtitle')} · {t('tutorial.step', { n: step + 1, total })}
            </DialogDescription>
          </DialogHeader>

          {/* Progress dots */}
          <div className="flex justify-center gap-1.5 py-1" role="presentation">
            {steps.map((_, i) => (
              <span
                key={i}
                className={`h-1.5 rounded-full transition-all ${
                  i === step ? 'w-8 bg-primary' : i < step ? 'w-3 bg-primary/60' : 'w-3 bg-muted'
                }`}
              />
            ))}
          </div>

          <div
            key={step}
            className="min-h-[120px] py-3 px-1 text-center space-y-2"
            role="region"
            aria-live="polite"
          >
            <h3 className="font-display font-bold text-lg">{current.title}</h3>
            <p className="text-sm text-muted-foreground leading-relaxed">{current.body}</p>
          </div>

          <div className="flex items-center justify-between pt-2 gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleSkip}
              className="gap-1"
            >
              <X className="w-3.5 h-3.5" /> {t('tutorial.skip')}
            </Button>
            <div className="flex gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={goBack}
                disabled={step === 0}
                className="gap-1"
              >
                <ArrowLeft className="w-3.5 h-3.5" /> {t('tutorial.back')}
              </Button>
              <Button type="button" size="sm" onClick={goNext} className="gap-1">
                {step >= total - 1 ? (
                  <>
                    <Check className="w-3.5 h-3.5" /> {t('tutorial.gotIt')}
                  </>
                ) : (
                  <>
                    {t('tutorial.next')} <ArrowRight className="w-3.5 h-3.5" />
                  </>
                )}
              </Button>
            </div>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
