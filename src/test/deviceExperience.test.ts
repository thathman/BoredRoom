import { afterEach, describe, expect, it, vi } from 'vitest';
import { detectDeviceClass } from '@/lib/deviceExperience';

function mockDevice(input: {
  width: number;
  userAgent: string;
  touchPoints: number;
  coarse: boolean;
  fine: boolean;
}) {
  Object.defineProperty(window, 'screen', { configurable: true, value: { width: input.width, height: input.width * 1.5 } });
  Object.defineProperty(navigator, 'userAgent', { configurable: true, value: input.userAgent });
  Object.defineProperty(navigator, 'maxTouchPoints', { configurable: true, value: input.touchPoints });
  Object.defineProperty(navigator, 'platform', { configurable: true, value: 'Linux' });
  window.matchMedia = vi.fn((query: string) => ({
    matches: query.includes('coarse') ? input.coarse : query.includes('fine') ? input.fine : false,
    media: query,
    onchange: null,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    addListener: vi.fn(),
    removeListener: vi.fn(),
    dispatchEvent: vi.fn(),
  }));
}

describe('device experience classification', () => {
  afterEach(() => localStorage.clear());

  it('keeps phones controller-only', () => {
    mockDevice({ width: 390, userAgent: 'Mozilla/5.0 iPhone', touchPoints: 5, coarse: true, fine: false });
    expect(detectDeviceClass()).toBe('mobile_controller');
  });

  it('routes touch tablets to controller or companion mode', () => {
    mockDevice({ width: 820, userAgent: 'Mozilla/5.0 Tablet', touchPoints: 5, coarse: true, fine: false });
    expect(detectDeviceClass()).toBe('tablet');
  });

  it('keeps laptops and TVs as hosts', () => {
    mockDevice({ width: 1440, userAgent: 'Mozilla/5.0 Desktop', touchPoints: 0, coarse: false, fine: true });
    expect(detectDeviceClass()).toBe('desktop_host');
  });
});
