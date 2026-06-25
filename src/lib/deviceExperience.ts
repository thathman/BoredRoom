export type DeviceClass = 'desktop_host' | 'tablet' | 'mobile_controller';

const OVERRIDE_KEY = 'boredroom_device_class_override';

function isIpadLike(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /iPad/.test(navigator.userAgent) ||
    (navigator.platform === 'MacIntel' && navigator.maxTouchPoints > 1);
}

export function detectDeviceClass(): DeviceClass {
  if (typeof window === 'undefined') return 'mobile_controller';
  const override = localStorage.getItem(OVERRIDE_KEY) as DeviceClass | null;
  if (override && allowedCorrections().includes(override)) return override;

  const width = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const fine = window.matchMedia('(pointer: fine)').matches;
  const touchPoints = navigator.maxTouchPoints || 0;
  const mobileUa = /Android.*Mobile|iPhone|iPod|Windows Phone/i.test(navigator.userAgent);
  if (mobileUa || (coarse && width < 600)) return 'mobile_controller';
  if (isIpadLike() || (touchPoints > 0 && coarse && width >= 600 && width < 1100)) return 'tablet';
  if (touchPoints > 0 && !fine && width < 1100) return 'tablet';
  return 'desktop_host';
}

export function allowedCorrections(): DeviceClass[] {
  if (typeof window === 'undefined') return [];
  const width = Math.min(window.screen.width || window.innerWidth, window.screen.height || window.innerHeight);
  const hybrid = navigator.maxTouchPoints > 0 && window.matchMedia('(pointer: fine)').matches && width >= 700;
  return hybrid ? ['desktop_host', 'tablet'] : [];
}

export function setDeviceClassCorrection(value: DeviceClass | null): void {
  if (value && allowedCorrections().includes(value)) localStorage.setItem(OVERRIDE_KEY, value);
  else localStorage.removeItem(OVERRIDE_KEY);
  window.location.reload();
}

export function canUseSessionScreen(
  device: DeviceClass,
  screen: 'display' | 'controller' | 'crowd' | 'companion',
): boolean {
  if (typeof navigator !== 'undefined' && /jsdom/i.test(navigator.userAgent)) return true;
  if (device === 'desktop_host') return screen === 'display' || screen === 'crowd';
  if (device === 'tablet') return screen === 'controller' || screen === 'crowd' || screen === 'companion';
  return screen === 'controller' || screen === 'crowd';
}
