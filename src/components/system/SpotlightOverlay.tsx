/**
 * Spotlight overlay — dims the screen, cuts a hole around a target element,
 * and shows a coach-mark tooltip pointing at it. One-shot per device per
 * spotlight key (stored in localStorage).
 *
 * Usage:
 *   const ref = useRef<HTMLButtonElement>(null);
 *   <button ref={ref}>Roll</button>
 *   <SpotlightOverlay
 *     storageKey="hustle:first-roll"
 *     targetRef={ref}
 *     message={t('spotlight.tapHere')}
 *     enabled={isMyTurn && state.turnNumber === 1}
 *   />
 */
import { useEffect, useLayoutEffect, useState } from 'react';
import { useTranslation } from 'react-i18next';
import { trackEvent } from '@/lib/analytics';

interface Rect {
  top: number;
  left: number;
  width: number;
  height: number;
}

interface Props {
  /** Stable id; localStorage flag key = `boredroom:spotlight-seen:${storageKey}`. */
  storageKey: string;
  targetRef: React.RefObject<HTMLElement>;
  message?: string;
  /** Gate when the spotlight is allowed to show (e.g. only on first turn). */
  enabled?: boolean;
  /** Padding around the target rectangle, px. */
  padding?: number;
}

const seenKey = (k: string) => `boredroom:spotlight-seen:${k}`;

function readRect(el: HTMLElement, padding: number): Rect {
  const r = el.getBoundingClientRect();
  return {
    top: Math.max(0, r.top - padding),
    left: Math.max(0, r.left - padding),
    width: r.width + padding * 2,
    height: r.height + padding * 2,
  };
}

export function SpotlightOverlay({
  storageKey,
  targetRef,
  message,
  enabled = true,
  padding = 8,
}: Props) {
  const { t } = useTranslation();
  const [shouldShow, setShouldShow] = useState(false);
  const [rect, setRect] = useState<Rect | null>(null);

  useEffect(() => {
    if (!enabled) return;
    try {
      const seen = localStorage.getItem(seenKey(storageKey));
      if (!seen) {
        setShouldShow(true);
        trackEvent('spotlight_shown', { key: storageKey });
      }
    } catch {
      // ignore — private mode etc.
    }
  }, [enabled, storageKey]);

  useLayoutEffect(() => {
    if (!shouldShow) return;
    const el = targetRef.current;
    if (!el) return;
    const update = () => setRect(readRect(el, padding));
    update();
    window.addEventListener('resize', update);
    window.addEventListener('scroll', update, true);
    return () => {
      window.removeEventListener('resize', update);
      window.removeEventListener('scroll', update, true);
    };
  }, [shouldShow, targetRef, padding]);

  const dismiss = () => {
    try {
      localStorage.setItem(seenKey(storageKey), '1');
    } catch {
      // ignore
    }
    setShouldShow(false);
    trackEvent('spotlight_dismissed', { key: storageKey });
  };

  if (!shouldShow || !rect) return null;

  // SVG mask: full overlay minus the target rectangle.
  const maskId = `spotlight-mask-${storageKey.replace(/[^\w-]/g, '_')}`;
  return (
    <div
      className="fixed inset-0 z-[60] pointer-events-auto"
      role="dialog"
      aria-modal="true"
      aria-label={message ?? (t('spotlight.tapHere') as string)}
      onClick={dismiss}
    >
      <svg className="absolute inset-0 w-full h-full" aria-hidden>
        <defs>
          <mask id={maskId}>
            <rect width="100%" height="100%" fill="white" />
            <rect
              x={rect.left}
              y={rect.top}
              width={rect.width}
              height={rect.height}
              rx={12}
              fill="black"
            />
          </mask>
        </defs>
        <rect
          width="100%"
          height="100%"
          fill="rgba(0,0,0,0.72)"
          mask={`url(#${maskId})`}
        />
        <rect
          x={rect.left}
          y={rect.top}
          width={rect.width}
          height={rect.height}
          rx={12}
          fill="none"
          stroke="hsl(var(--primary))"
          strokeWidth="2"
          className="animate-pulse"
        />
      </svg>
      <div
        className="absolute glass rounded-2xl px-4 py-3 max-w-xs text-center shadow-2xl border border-primary/60"
        style={{
          left: Math.max(8, Math.min(rect.left + rect.width / 2 - 140, window.innerWidth - 296)),
          top: rect.top + rect.height + 12,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <p className="font-display font-bold text-sm">
          {message ?? t('spotlight.tapHere')}
        </p>
        <p className="text-[10px] text-muted-foreground mt-1">
          {t('spotlight.yourFirstMove')}
        </p>
        <button
          type="button"
          onClick={dismiss}
          className="mt-2 text-xs uppercase tracking-wider text-primary"
        >
          {t('spotlight.got_it')}
        </button>
      </div>
    </div>
  );
}
