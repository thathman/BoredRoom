// Derive an AI provider status chip from a rolling window of call results.
// Status semantics agreed for this build:
//   active    = recent successful call within the last ~30s
//   degraded  = >2s latency on the most recent call OR exactly 1 recent failure
//   offline   = 2+ consecutive recent failures
//   fallback  = a successful call returned no usable line (server fell back to canned text)
// We keep the window bounded to the last 6 results.

import type { AICallMeta } from './ai';
import type { AIStatus } from './realtimeRoom';

const WINDOW = 6;
const FRESH_MS = 30_000;
const SLOW_MS = 2_000;

interface Sample extends AICallMeta {
  at: number;
  fallback?: boolean;
}

export class AIStatusTracker {
  private samples: Sample[] = [];
  private lastEmitted: AIStatus | null = null;

  record(meta: AICallMeta, opts: { fallback?: boolean } = {}): AIStatus {
    this.samples.push({ ...meta, at: Date.now(), fallback: opts.fallback });
    if (this.samples.length > WINDOW) this.samples.shift();
    return this.compute();
  }

  compute(): AIStatus {
    const recent = this.samples.filter(s => Date.now() - s.at < FRESH_MS);
    if (recent.length === 0) return this.lastEmitted ?? 'active';

    const last = recent[recent.length - 1];
    const trailingFailures = (() => {
      let n = 0;
      for (let i = recent.length - 1; i >= 0; i--) {
        if (!recent[i].ok) n++;
        else break;
      }
      return n;
    })();

    let next: AIStatus;
    if (trailingFailures >= 2) next = 'offline';
    else if (last.fallback && last.ok) next = 'fallback';
    else if (!last.ok || last.latencyMs > SLOW_MS) next = 'degraded';
    else next = 'active';

    this.lastEmitted = next;
    return next;
  }

  /** Returns true if the computed status changed since the last emit. */
  changedSince(prev: AIStatus | null): boolean {
    return this.compute() !== prev;
  }
}
