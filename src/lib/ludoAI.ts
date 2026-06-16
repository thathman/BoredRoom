import type { PublicEvent, RecapInput } from './ai';
import type { LudoState } from '@/game/ludoEngine';

function playerName(state: LudoState, id: string | null | undefined): string {
  if (!id) return '';
  return state.players.find((p) => p.id === id)?.displayName ?? id;
}

function currentActor(prev: LudoState): string {
  return prev.players[prev.currentPlayerIndex]?.displayName ?? 'Player';
}

export function mapLudoTransitionToEvents(
  prev: LudoState | null | undefined,
  next: LudoState,
): PublicEvent[] {
  if (!prev) return [];
  const events: PublicEvent[] = [];
  const actor = currentActor(prev);
  const lastAction = next.lastAction ?? '';

  if (next.winner && next.winner !== prev.winner) {
    events.push({ type: 'win', actor: playerName(next, next.winner) || actor });
    return events;
  }

  if (next.dice && next.dice !== prev.dice) {
    const [d1, d2] = next.dice;
    if (d1 === 6 || d2 === 6) {
      events.push({ type: 'roll', actor, value: 6 });
    }
  }

  if (lastAction !== prev.lastAction) {
    if (lastAction.includes('captured')) {
      const target = lastAction.match(/captured (.+?)'s token/)?.[1];
      events.push({ type: 'capture', actor, target });
    }
    if (lastAction.includes('home') && next.phase !== 'finished') {
      events.push({ type: 'home', actor });
    }
    if (lastAction.includes('forfeited') || lastAction.includes('3 sixes')) {
      events.push({ type: 'skip', actor });
    }
  }

  return events;
}

export function buildLudoRecapInput(input: {
  roomCode: string;
  state: LudoState;
  matchStartedAt: number;
}): RecapInput {
  const winner = input.state.players.find((p) => p.id === input.state.winner);
  return {
    roomCode: input.roomCode,
    players: input.state.players.map((p) => ({
      name: p.displayName,
      color: p.color,
      tokensHome: p.finishedTokens,
    })),
    winnerName: winner?.displayName ?? '',
    turnCount: input.state.turnNumber,
    matchDurationMs: Date.now() - input.matchStartedAt,
    gameType: 'ludo',
  };
}
