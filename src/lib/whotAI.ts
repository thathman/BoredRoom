// Pure adapters that turn Whot public-state transitions into AI events
// (commentary pipeline) and accumulate match-level signals for recap.
//
// All functions are pure; the host runtime owns the rolling refs.

import type { PublicEvent, RecapInput } from './ai';
import type { WhotPublicState } from './transport/types';

export interface WhotMatchSignals {
  pickChainsTriggered: number;
  pickChainsConsumed: number;
  maxPickStack: number;
  suspensions: number;
  generalMarkets: number;
  suitCalls: number;
  lastCardAnnounces: number;
  totalPlays: number;
}

export function emptyWhotSignals(): WhotMatchSignals {
  return {
    pickChainsTriggered: 0,
    pickChainsConsumed: 0,
    maxPickStack: 0,
    suspensions: 0,
    generalMarkets: 0,
    suitCalls: 0,
    lastCardAnnounces: 0,
    totalPlays: 0,
  };
}

function nameFor(state: WhotPublicState, id: string | null | undefined): string {
  if (!id) return '';
  return state.players.find((p) => p.id === id)?.displayName ?? id;
}

/**
 * Diff two consecutive public Whot states into a list of PublicEvents the AI
 * commentary pipeline can consume. Returns [] when no meaningful transition
 * happened (idempotent across no-op renders).
 */
export function mapWhotTransitionToEvents(
  prev: WhotPublicState | null | undefined,
  next: WhotPublicState,
): PublicEvent[] {
  const events: PublicEvent[] = [];
  if (!prev) return events;

  // Win
  if (next.winnerId && next.winnerId !== prev.winnerId) {
    events.push({ type: 'whot_win', actor: nameFor(next, next.winnerId) });
    return events; // no other commentary needed at terminal moment
  }

  const prevTop = prev.topDiscard?.id ?? null;
  const nextTop = next.topDiscard?.id ?? null;
  const playOccurred = nextTop !== prevTop && next.topDiscard != null;

  // Pick chain growing (someone added to pendingDrawCount)
  const prevPending = prev.pendingDrawCount ?? 0;
  const nextPending = next.pendingDrawCount ?? 0;
  if (nextPending > prevPending) {
    events.push({
      type: 'whot_pick_chain',
      actor: nameFor(prev, prev.currentPlayerId),
      value: nextPending,
    });
  } else if (prevPending > 0 && nextPending === 0 && !playOccurred) {
    // Chain consumed by a draw (not countered)
    events.push({
      type: 'whot_pick_consume',
      actor: nameFor(prev, prev.currentPlayerId),
      value: prevPending,
    });
  }

  // Suit call (mustCallSuit transitioned from true → false, with shape change)
  if (prev.mustCallSuit && !next.mustCallSuit && prev.activeShape !== next.activeShape) {
    events.push({
      type: 'whot_suit_call',
      actor: nameFor(prev, prev.currentPlayerId),
      shape: next.activeShape,
    });
  }

  // Suspension / General market — infer from played card value when a play happened
  if (playOccurred && next.topDiscard) {
    const v = next.topDiscard.value;
    if (v === 8) {
      events.push({ type: 'whot_suspension', actor: nameFor(prev, prev.currentPlayerId) });
    } else if (v === 14) {
      events.push({ type: 'whot_general_market', actor: nameFor(prev, prev.currentPlayerId) });
    }
    events.push({
      type: 'whot_play',
      actor: nameFor(prev, prev.currentPlayerId),
      value: v,
      shape: next.topDiscard.shape,
    });
  }

  // Last-card announce (someone newly added to lastCardAnnounced[])
  const prevAnn = new Set(prev.lastCardAnnounced ?? []);
  for (const id of next.lastCardAnnounced ?? []) {
    if (!prevAnn.has(id)) {
      events.push({ type: 'whot_last_card', actor: nameFor(next, id) });
    }
  }

  return events;
}

/**
 * Fold a batch of events into the rolling match-level signal counters.
 * Returns a NEW object (does not mutate input).
 */
export function foldEventsIntoSignals(
  signals: WhotMatchSignals,
  events: PublicEvent[],
): WhotMatchSignals {
  const out: WhotMatchSignals = { ...signals };
  for (const ev of events) {
    switch (ev.type) {
      case 'whot_play':
        out.totalPlays += 1;
        break;
      case 'whot_pick_chain':
        out.pickChainsTriggered += 1;
        if ((ev.value ?? 0) > out.maxPickStack) out.maxPickStack = ev.value ?? 0;
        break;
      case 'whot_pick_consume':
        out.pickChainsConsumed += 1;
        break;
      case 'whot_suit_call':
        out.suitCalls += 1;
        break;
      case 'whot_suspension':
        out.suspensions += 1;
        break;
      case 'whot_general_market':
        out.generalMarkets += 1;
        break;
      case 'whot_last_card':
        out.lastCardAnnounces += 1;
        break;
      default:
        break;
    }
  }
  return out;
}

/**
 * Build the input payload for getRecap() at end of a Whot match.
 * Schema is intentionally compatible with the Ludo recap shape (winnerName,
 * turnCount, matchDurationMs, players[]) so the existing edge function keeps
 * working without changes.
 *
 * Whot-specific signals are appended to the headline-friendly `players` list
 * via `tokensHome` overload (re-purposed as "hand size at finish") only when
 * meaningful — but the canonical Whot signals are surfaced through `signals`
 * which the caller can serialize into the prompt body.
 */
export function buildWhotRecapInput(input: {
  roomCode: string;
  state: WhotPublicState;
  signals: WhotMatchSignals;
  matchStartedAt: number;
}): RecapInput {
  const winner = input.state.players.find((p) => p.id === input.state.winnerId);
  return {
    roomCode: input.roomCode,
    players: input.state.players.map((p) => ({
      name: p.displayName,
      color: p.color ?? '',
      // Re-purpose tokensHome as inverse hand-size proxy (lower = closer to win).
      tokensHome: Math.max(0, 10 - p.handCount),
    })),
    winnerName: winner?.displayName ?? '',
    turnCount: input.state.turnNumber,
    matchDurationMs: Date.now() - input.matchStartedAt,
    gameType: 'whot',
    signals: { ...input.signals },
  };
}
