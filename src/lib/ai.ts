// Thin client wrappers for the AI edge functions.
// All calls fail soft: never throw to the UI.

import { supabase } from '@/integrations/supabase/client';

export type PublicEventType =
  // Ludo
  | 'roll' | 'capture' | 'home' | 'win' | 'skip'
  // Whot (additive)
  | 'whot_play'
  | 'whot_pick_chain'
  | 'whot_pick_consume'
  | 'whot_suit_call'
  | 'whot_suspension'
  | 'whot_general_market'
  | 'whot_last_card'
  | 'whot_win';

export interface PublicEvent {
  type: PublicEventType;
  actor: string;
  target?: string;
  value?: number;
  /** For Whot suit calls / shape-bearing events. */
  shape?: string;
}

export interface RecapPayload {
  headline: string;
  paragraph: string;
  mvp: string;
}

export interface AICallMeta {
  ok: boolean;
  latencyMs: number;
  error?: string;
}

export type AICallResult<T> = { value: T | null; meta: AICallMeta };

export type AIGameType = 'ludo' | 'whot';
export type AIPersona = 'classic' | 'naija_hype' | 'chaos_mc' | 'banker';

export interface CommentaryInput {
  roomCode: string;
  events: PublicEvent[];
  players: { name: string; color: string }[];
  gameType?: AIGameType;
  persona?: AIPersona;
}

export interface RecapInput {
  roomCode: string;
  players: { name: string; color: string; tokensHome: number }[];
  winnerName: string;
  turnCount: number;
  matchDurationMs: number;
  gameType?: AIGameType;
  signals?: Record<string, number>;
}

const localCooldown = {
  commentary: new Map<string, number>(),
  hint: new Map<string, number>(),
};

// Subscribers (host useRoom) get notified on every AI call result so they can
// derive a status chip (active / degraded / offline / fallback).
type Listener = (kind: 'commentary' | 'hint' | 'recap', meta: AICallMeta) => void;
const listeners = new Set<Listener>();

export function onAICall(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

function notify(kind: 'commentary' | 'hint' | 'recap', meta: AICallMeta) {
  listeners.forEach(l => {
    try { l(kind, meta); } catch { /* noop */ }
  });
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'unknown';
}

function commentaryCooldownKey(input: CommentaryInput): string {
  return `${input.roomCode || '_'}:${input.gameType ?? 'ludo'}`;
}

export async function getCommentary(input: CommentaryInput): Promise<string | null> {
  const key = commentaryCooldownKey(input);
  const last = localCooldown.commentary.get(key) ?? 0;
  if (Date.now() - last < 3500) return null;
  localCooldown.commentary.set(key, Date.now());
  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('ai-commentary', { body: input });
    const latencyMs = performance.now() - start;
    if (error) {
      console.warn('[ai] commentary error', error.message);
      notify('commentary', { ok: false, latencyMs, error: error.message });
      return null;
    }
    notify('commentary', { ok: true, latencyMs });
    return (data as { line: string | null })?.line ?? null;
  } catch (e: unknown) {
    const latencyMs = performance.now() - start;
    console.warn('[ai] commentary failed', e);
    notify('commentary', { ok: false, latencyMs, error: errorMessage(e) });
    return null;
  }
}

export async function getHint(input: {
  playerId: string;
  deviceId: string;
  diceValue: number;
  myColor: string;
  myTokens: { id: number; position: number }[];
  movableTokenIds: number[];
  opponentsSummary: { color: string; tokensHome: number }[];
}): Promise<string | null> {
  const last = localCooldown.hint.get(input.playerId) ?? 0;
  if (Date.now() - last < 1800) return null;
  localCooldown.hint.set(input.playerId, Date.now());
  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('ai-hint', { body: input });
    const latencyMs = performance.now() - start;
    if (error) {
      console.warn('[ai] hint error', error.message);
      notify('hint', { ok: false, latencyMs, error: error.message });
      return null;
    }
    notify('hint', { ok: true, latencyMs });
    return (data as { hint: string | null })?.hint ?? null;
  } catch (e: unknown) {
    const latencyMs = performance.now() - start;
    console.warn('[ai] hint failed', e);
    notify('hint', { ok: false, latencyMs, error: errorMessage(e) });
    return null;
  }
}

export async function getRecap(input: RecapInput): Promise<RecapPayload | null> {
  const start = performance.now();
  try {
    const { data, error } = await supabase.functions.invoke('ai-recap', { body: input });
    const latencyMs = performance.now() - start;
    if (error) {
      console.warn('[ai] recap error', error.message);
      notify('recap', { ok: false, latencyMs, error: error.message });
      return null;
    }
    notify('recap', { ok: true, latencyMs });
    return (data as { recap: RecapPayload | null })?.recap ?? null;
  } catch (e: unknown) {
    const latencyMs = performance.now() - start;
    console.warn('[ai] recap failed', e);
    notify('recap', { ok: false, latencyMs, error: errorMessage(e) });
    return null;
  }
}
