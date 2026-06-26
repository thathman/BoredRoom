import { useEffect, useRef, useState } from 'react';

type WakeLockSentinelLike = {
  released: boolean;
  release: () => Promise<void>;
  addEventListener: (type: 'release', listener: () => void) => void;
  removeEventListener: (type: 'release', listener: () => void) => void;
};

type NavigatorWithWakeLock = Navigator & {
  wakeLock?: {
    request: (type: 'screen') => Promise<WakeLockSentinelLike>;
  };
};

export function useWakeLock(enabled: boolean): 'active' | 'unsupported' | 'released' {
  const sentinelRef = useRef<WakeLockSentinelLike | null>(null);
  const [status, setStatus] = useState<'active' | 'unsupported' | 'released'>('released');

  useEffect(() => {
    if (!enabled || typeof navigator === 'undefined') return undefined;
    const wakeLock = (navigator as NavigatorWithWakeLock).wakeLock;
    if (!wakeLock) {
      setStatus('unsupported');
      return undefined;
    }

    let cancelled = false;
    const onRelease = () => {
      sentinelRef.current = null;
      if (!cancelled) setStatus('released');
    };

    async function requestLock() {
      try {
        const sentinel = await wakeLock.request('screen');
        if (cancelled) {
          await sentinel.release().catch(() => undefined);
          return;
        }
        sentinelRef.current = sentinel;
        sentinel.addEventListener('release', onRelease);
        setStatus('active');
      } catch {
        if (!cancelled) setStatus('released');
      }
    }

    void requestLock();
    const onVisibility = () => {
      if (document.visibilityState === 'visible' && !sentinelRef.current) void requestLock();
    };
    document.addEventListener('visibilitychange', onVisibility);

    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisibility);
      const sentinel = sentinelRef.current;
      sentinelRef.current = null;
      if (sentinel && !sentinel.released) {
        sentinel.removeEventListener('release', onRelease);
        void sentinel.release().catch(() => undefined);
      }
    };
  }, [enabled]);

  return status;
}
