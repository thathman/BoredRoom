// Shared helpers used by multiple room implementations.
// Kept tiny + dependency-free. Each room is otherwise standalone.
//
// History: this module was extracted when WhotRoom was split out of LudoRoom.
// Both rooms (and any future close cousin) reach for these same primitives —
// uuid, numeric clamping, text sanitization for host-broadcast lines, and the
// presence-bookkeeping pattern. Keeping them centralized prevents drift.

import type { PublicRoomState, SeatPresence } from '../../../shared/src/contracts/index.js';

/** Lightweight uuid that prefers `crypto.randomUUID` and falls back deterministically. */
export function uuid(): string {
  if (typeof crypto !== 'undefined' && 'randomUUID' in crypto) {
    return (crypto as { randomUUID(): string }).randomUUID();
  }
  return `${Date.now()}-${Math.floor(Math.random() * 1e9)}`;
}

/** Floor + clamp to [min, max]. NaN / non-numbers collapse to `min`. */
export function clampNum(value: number, min: number, max: number): number {
  if (typeof value !== 'number' || Number.isNaN(value)) return min;
  return Math.max(min, Math.min(max, Math.floor(value)));
}

const PROFANITY = ['fuck', 'shit', 'bitch', 'asshole', 'cunt', 'nigger', 'faggot', 'retard'];

/** Trim, collapse whitespace, truncate, and mask a small profanity list.
 *  Used for host-broadcast strings (commentary, recaps, end-game messages). */
export function sanitizeText(value: unknown, maxLen: number): string {
  let out = String(value ?? '').trim().replace(/\s+/g, ' ').slice(0, maxLen);
  for (const bad of PROFANITY) {
    out = out.replace(new RegExp(`\\b${bad}\\b`, 'gi'), '***');
  }
  return out;
}

/** Patch a seat's presence record in-place, refreshing lastSeenAt. */
export function markPresence(
  pub: PublicRoomState,
  seatId: string,
  patch: Partial<{ connected: boolean; hidden: boolean; pauseRequested: boolean }>,
): void {
  const now = Date.now();
  const current: SeatPresence = pub.presenceBySeat?.[seatId] ?? {
    connected: false,
    hidden: false,
    lastSeenAt: now,
    pauseRequested: false,
  };
  pub.presenceBySeat = {
    ...(pub.presenceBySeat ?? {}),
    [seatId]: {
      ...current,
      ...patch,
      lastSeenAt: now,
    },
  };
}

export function clearPauseState(pub: PublicRoomState): void {
  pub.pauseState = { paused: false, reason: null, requestedBy: null, since: null, message: null };
}

export function clearPauseRequests(pub: PublicRoomState): void {
  for (const p of Object.values(pub.presenceBySeat ?? {})) p.pauseRequested = false;
}

export function pauseGameIfPlaying(
  pub: PublicRoomState,
  reason: 'host' | 'player_visibility' | 'player_request',
  requestedBy: string,
  message: string,
): boolean {
  if (pub.status !== 'playing') return false;
  if (pub.pauseState?.paused) return false;
  pub.pauseState = {
    paused: true,
    reason,
    requestedBy,
    since: Date.now(),
    message,
  };
  return true;
}
