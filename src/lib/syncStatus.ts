// Pure helper for deriving connection sync status. UI uses this to decide
// whether to show a full-screen connecting spinner, a "restoring seat" overlay,
// or a thin "reconnecting" banner — without unmounting underlying views.

export type SyncStatus = 'connecting' | 'syncing' | 'ready' | 'reconnecting';

export interface SyncStatusInput {
  /** True once the realtime channel has reached SUBSCRIBED at least once. */
  subscribed: boolean;
  /** True once we've received an authoritative state we belong to. */
  hasAuthoritativeState: boolean;
  /** True if syncStatus has previously reached 'ready'. */
  wasReady: boolean;
  /** Last channel error/status if not SUBSCRIBED (CHANNEL_ERROR/TIMED_OUT/CLOSED). */
  lastError?: string | null;
}

export function deriveSyncStatus(input: SyncStatusInput): SyncStatus {
  const { subscribed, hasAuthoritativeState, wasReady, lastError } = input;

  // If we have an active error after being ready → reconnecting.
  if (wasReady && lastError) return 'reconnecting';

  // If never subscribed → connecting.
  if (!subscribed) return 'connecting';

  // Subscribed but no authoritative state yet.
  if (!hasAuthoritativeState) {
    return wasReady ? 'reconnecting' : 'syncing';
  }

  return 'ready';
}
