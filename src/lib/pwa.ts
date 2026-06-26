export interface DeferredPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>;
}

// --- Real install-prompt capture -------------------------------------------
// The browser fires `beforeinstallprompt` once, early. We capture and store the real event so
// any UI (e.g. the landing "Add to home screen" button) can trigger it on a user gesture later.
// Never synthesise this event — a fake one has no usable `prompt()`.
let deferredPrompt: DeferredPromptEvent | null = null;
const availabilityListeners = new Set<(available: boolean) => void>();

export function initInstallPromptCapture(): void {
  if (typeof window === 'undefined') return;
  window.addEventListener('beforeinstallprompt', (event) => {
    event.preventDefault();
    deferredPrompt = event as DeferredPromptEvent;
    availabilityListeners.forEach((cb) => cb(true));
  });
  window.addEventListener('appinstalled', () => {
    deferredPrompt = null;
    availabilityListeners.forEach((cb) => cb(false));
  });
}

export function isInstallPromptAvailable(): boolean {
  return deferredPrompt !== null;
}

export function onInstallAvailabilityChange(cb: (available: boolean) => void): () => void {
  availabilityListeners.add(cb);
  return () => availabilityListeners.delete(cb);
}

// Returns true if the native prompt was shown and accepted. If no real prompt is available
// (iOS Safari, or already installed), returns false so callers can show A2HS instructions.
export async function promptInstall(): Promise<boolean> {
  if (!deferredPrompt) return false;
  try {
    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;
    if (choice.outcome === 'accepted') deferredPrompt = null;
    return choice.outcome === 'accepted';
  } catch {
    return false;
  }
}

// iOS Safari never fires beforeinstallprompt; detect it so we can show manual A2HS help.
export function isIosSafari(): boolean {
  if (typeof navigator === 'undefined') return false;
  const ua = navigator.userAgent;
  const maxTouch = (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints ?? 0;
  const isIos = /iphone|ipad|ipod/i.test(ua) || (navigator.platform === 'MacIntel' && maxTouch > 1);
  const isSafari = /safari/i.test(ua) && !/crios|fxios|edgios/i.test(ua);
  return isIos && isSafari;
}

export function isStandalonePWA(): boolean {
  const nav = window.navigator as Navigator & { standalone?: boolean };
  return window.matchMedia('(display-mode: standalone)').matches || nav.standalone === true;
}

export function isMobileLikeDevice(): boolean {
  if (typeof window === 'undefined') return false;
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const narrow = window.innerWidth <= 1024;
  return coarse && narrow;
}

export async function resetPwaCacheAndReload(): Promise<void> {
  try {
    if ('serviceWorker' in navigator) {
      const regs = await navigator.serviceWorker.getRegistrations();
      await Promise.all(regs.map((r) => r.unregister()));
    }
    if ('caches' in window) {
      const keys = await caches.keys();
      await Promise.all(keys.map((k) => caches.delete(k)));
    }
  } finally {
    window.location.reload();
  }
}
