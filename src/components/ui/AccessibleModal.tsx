// Accessible modal/sheet wrapper used by game controllers.
// Provides:
//  - role="dialog" + aria-modal + aria-labelledby
//  - Focus trap (tab cycles within modal)
//  - Restores focus to trigger on close
//  - Esc closes
//  - Click backdrop closes (optional)
//  - Bottom-sheet on mobile, centered card on sm+

import { useEffect, useRef, type ReactNode } from 'react';

interface AccessibleModalProps {
  open: boolean;
  onClose: () => void;
  /** Visible heading text — also used as aria-labelledby target. */
  title: string;
  children: ReactNode;
  /** Disable backdrop-click close (defaults to enabled). */
  disableBackdropClose?: boolean;
  /** Extra classes for the inner card. */
  className?: string;
}

export function AccessibleModal({
  open,
  onClose,
  title,
  children,
  disableBackdropClose,
  className = '',
}: AccessibleModalProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const previouslyFocused = useRef<HTMLElement | null>(null);
  const titleId = useRef(`modal-title-${Math.random().toString(36).slice(2, 8)}`);

  useEffect(() => {
    if (!open) return;
    previouslyFocused.current = document.activeElement as HTMLElement | null;

    // Focus first focusable element (or container itself).
    const t = window.setTimeout(() => {
      const root = containerRef.current;
      if (!root) return;
      const first = root.querySelector<HTMLElement>(
        'input, select, textarea, button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
      );
      (first ?? root).focus();
    }, 0);

    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        onClose();
        return;
      }
      if (e.key !== 'Tab') return;
      const root = containerRef.current;
      if (!root) return;
      const focusable = Array.from(
        root.querySelectorAll<HTMLElement>(
          'input:not([disabled]), select:not([disabled]), textarea:not([disabled]), button:not([disabled]), [href], [tabindex]:not([tabindex="-1"])',
        ),
      ).filter((el) => !el.hasAttribute('aria-hidden'));
      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }
      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      const active = document.activeElement as HTMLElement | null;
      if (e.shiftKey && active === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && active === last) {
        e.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKey, true);
    return () => {
      window.clearTimeout(t);
      document.removeEventListener('keydown', handleKey, true);
      previouslyFocused.current?.focus?.();
    };
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 bg-background/80 backdrop-blur flex items-end sm:items-center justify-center p-3 sm:p-6"
      onClick={(e) => {
        if (disableBackdropClose) return;
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        ref={containerRef}
        role="dialog"
        aria-modal="true"
        aria-labelledby={titleId.current}
        tabIndex={-1}
        className={`glass rounded-t-2xl sm:rounded-2xl border border-border/40 p-4 sm:p-5 w-full max-w-sm space-y-3 max-h-[90vh] overflow-y-auto outline-none focus:ring-2 focus:ring-primary/40 ${className}`}
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom), 1rem)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <p id={titleId.current} className="font-display text-lg font-bold text-center">
          {title}
        </p>
        {children}
      </div>
    </div>
  );
}
