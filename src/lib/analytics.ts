/**
 * Tiny client-side analytics dispatcher.
 *
 * For now, events flow to:
 *   1. console.info (so server log scrapers / browser devtools can pick them up)
 *   2. window.dispatchEvent — so any external listener (e.g. a future GA4 or
 *      PostHog snippet, or our own server bridge) can subscribe.
 *
 * No PII is sent. Keep payloads minimal and serialisable.
 */
export interface AnalyticsEvent {
  name: string;
  payload?: Record<string, unknown>;
  ts: number;
}

const CHANNEL = 'boredroom:analytics';

export function trackEvent(name: string, payload?: Record<string, unknown>): void {
  const evt: AnalyticsEvent = { name, payload, ts: Date.now() };
  try {
    console.info('[analytics]', name, payload ?? {});
    if (typeof window !== 'undefined') {
      window.dispatchEvent(new CustomEvent(CHANNEL, { detail: evt }));
    }
  } catch {
    // never throw from analytics
  }
}

/** Subscribe to all client-side analytics events. Returns unsubscribe. */
export function onAnalyticsEvent(handler: (evt: AnalyticsEvent) => void): () => void {
  if (typeof window === 'undefined') return () => undefined;
  const wrapped = (e: Event) => {
    const ce = e as CustomEvent<AnalyticsEvent>;
    if (ce?.detail) handler(ce.detail);
  };
  window.addEventListener(CHANNEL, wrapped);
  return () => window.removeEventListener(CHANNEL, wrapped);
}
