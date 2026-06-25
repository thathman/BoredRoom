// Session-first routing (Phase 4).
//
// A house session drives four screens under /session/:code/<screen>. Routing is session-scoped,
// not game-scoped (the old /:game/* routes stay for existing games — strangler-fig). This module
// holds the pure path/role logic so the router and screens stay thin and testable.

import { detectDeviceClass } from '@/lib/deviceExperience';

export type SessionScreen = 'display' | 'controller' | 'crowd' | 'companion';

export const SESSION_SCREENS: SessionScreen[] = ['display', 'controller', 'crowd', 'companion'];

export function isSessionScreen(value: string | undefined | null): value is SessionScreen {
  return !!value && (SESSION_SCREENS as string[]).includes(value);
}

export function sessionPath(code: string, screen: SessionScreen): string {
  return `/session/${encodeURIComponent(code)}/${screen}`;
}

// Which screen a fresh device should land on: big screens host the public display, phones become
// controllers. Operator and crowd are always explicit (chosen from the display/QR).
export function defaultScreenForDevice(): SessionScreen {
  return detectDeviceClass() === 'desktop_host' ? 'display' : 'controller';
}

// State-boundary helper (constitution Art. II): which screens may see private player state.
export function screenSeesPrivateState(screen: SessionScreen): boolean {
  return screen === 'controller';
}

// Only the public display + crowd are "public" surfaces that must never show private state.
export function screenIsPublic(screen: SessionScreen): boolean {
  return screen === 'display' || screen === 'crowd';
}
