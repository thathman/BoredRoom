// Game adapter registry (Phase 6) — replaces per-game switch statements (constitution Art. I.6).
//
// Holds the logic core of each game adapter: capabilities + summaries + rules. Mirrors the canonical
// GameAdapterCore in @boredroom/shared (shared/src/contracts/adapter.ts); the mirror is checked
// against the shared types in src/test/adapters.test.ts. Adapting Ludo/Whot/Trivia first per the
// roadmap; the remaining games register the same way. Existing engines are reused unchanged — these
// adapters only project state into public/private summaries and surface metadata.

import { getGameMeta } from '@/lib/games';

export interface GameCapabilities {
  playerCount: { min: number; max: number };
  bots: boolean;
  audience: boolean;
  hints: boolean;
  voice: boolean;
  restore: boolean;
}

export interface PublicGameSummary {
  gameType: string;
  phase: string;
  players: { id: string; name?: string; score?: number }[];
  headline?: string;
}

export interface PrivateGameSummary {
  gameType: string;
  playerId: string;
  yourTurn: boolean;
  detail?: Record<string, unknown>;
}

export interface LegalAction {
  type: string;
  label?: string;
  payload?: Record<string, unknown>;
}

export interface GameAdapterCore {
  gameType: string;
  capabilities: GameCapabilities;
  getPublicSummary(state: unknown): PublicGameSummary;
  getPrivateSummary(state: unknown, playerId: string): PrivateGameSummary;
  getLegalActions(state: unknown, playerId: string): LegalAction[];
  explainRules(): string[];
  explainInvalidMove(reasonCode: string): string;
}

// Defensive readers — engine states vary, so project common fields without assuming a shape.
function readPhase(state: unknown): string {
  const s = state as { phase?: unknown };
  return typeof s?.phase === 'string' ? s.phase : 'unknown';
}

interface LoosePlayer {
  id?: string;
  deviceId?: string;
  name?: string;
  displayName?: string;
  score?: number;
  points?: number;
}

function readPlayers(state: unknown): PublicGameSummary['players'] {
  const s = state as { players?: LoosePlayer[] };
  if (!Array.isArray(s?.players)) return [];
  return s.players.map((p) => ({
    id: String(p.id ?? p.deviceId ?? ''),
    name: p.name ?? p.displayName,
    score: p.score ?? p.points,
  }));
}

function readCurrentPlayerId(state: unknown): string | null {
  const s = state as { currentPlayerId?: unknown; turnPlayerId?: unknown; activePlayerId?: unknown };
  const id = s?.currentPlayerId ?? s?.turnPlayerId ?? s?.activePlayerId;
  return typeof id === 'string' ? id : null;
}

// Build an adapter from the existing GAME_REGISTRY metadata so capabilities never drift from the
// catalog. Per-game overrides cover rule text and invalid-move messages.
function makeAdapter(
  gameType: string,
  overrides: Partial<Pick<GameCapabilities, 'audience' | 'hints' | 'voice' | 'restore' | 'bots' | 'playerCount'>> & {
    invalidMoves?: Record<string, string>;
    // For new games not (yet) in GAME_REGISTRY: supply rules/range explicitly.
    rules?: string[];
  } = {},
): GameAdapterCore {
  const meta = getGameMeta(gameType); // null for new games not in the legacy catalog
  const capabilities: GameCapabilities = {
    playerCount: overrides.playerCount ?? { min: meta?.minPlayers ?? 2, max: meta?.maxPlayers ?? 4 },
    bots: overrides.bots ?? meta?.supportsBots ?? false,
    audience: overrides.audience ?? true,
    hints: overrides.hints ?? false,
    voice: overrides.voice ?? false,
    restore: overrides.restore ?? false,
  };
  const invalidMoves = overrides.invalidMoves ?? {};
  const rules = overrides.rules ?? meta?.rules ?? [];
  return {
    gameType,
    capabilities,
    getPublicSummary: (state) => ({
      gameType,
      phase: readPhase(state),
      players: readPlayers(state),
    }),
    getPrivateSummary: (state, playerId) => ({
      gameType,
      playerId,
      yourTurn: readCurrentPlayerId(state) === playerId,
    }),
    getLegalActions: () => [],
    explainRules: () => rules,
    explainInvalidMove: (reasonCode) => invalidMoves[reasonCode] ?? 'That move is not allowed right now.',
  };
}

// Ludo / Whot / Trivia first (roadmap Phase 6).
export const GAME_ADAPTERS: Record<string, GameAdapterCore> = {
  ludo: makeAdapter('ludo', {
    hints: true,
    restore: true,
    invalidMoves: {
      need_six: 'You need a 6 to bring a token out of base.',
      not_your_turn: "It's not your turn yet.",
    },
  }),
  whot: makeAdapter('whot', {
    hints: true,
    restore: true,
    invalidMoves: {
      mismatch: 'That card does not match the shape or number on the pile.',
      not_your_turn: "It's not your turn yet.",
    },
  }),
  trivia: makeAdapter('trivia', {
    hints: false,
    voice: true,
    invalidMoves: { too_late: 'Time is up for this question.' },
  }),
  // New games (Phase 8) — not in the legacy GAME_REGISTRY, so capabilities/rules are explicit.
  'market-price': makeAdapter('market-price', {
    playerCount: { min: 1, max: 12 },
    bots: false,
    audience: true,
    restore: true,
    rules: [
      'A market item is revealed each round.',
      'Guess its price in Naira — closer guesses score more.',
      'Nail it (within 1%) for a bonus. Highest total after all rounds wins.',
    ],
    invalidMoves: { closed: 'Guessing is closed for this item.' },
  }),
};

export function getAdapter(gameType: string | undefined | null): GameAdapterCore | null {
  return (gameType && GAME_ADAPTERS[gameType]) || null;
}

export function hasAdapter(gameType: string | undefined | null): boolean {
  return !!getAdapter(gameType);
}
