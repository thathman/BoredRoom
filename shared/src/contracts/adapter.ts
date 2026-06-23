// Game adapter contract (Phase 6).
//
// Adapters replace per-game switch statements with a registry (constitution Art. I.6). This file
// holds the transport/UI-agnostic logic core of the contract — capabilities, summaries, legal
// actions, and rule explanations — which powers the setup wizard, AI rule assistant, hint engine,
// recaps, audience mode, restore, and recommendations. React component slots (Display/Controller/
// Setup/Recap) are layered on top in the UI registry when those screens exist.
// Canonical: BoredRoom-Spec/07-technical-architecture/01-game-adapter-contract.md.

export interface GameCapabilities {
  playerCount: { min: number; max: number };
  bots: boolean;
  audience: boolean;
  hints: boolean;
  voice: boolean;
  restore: boolean;
}

// A crowd/display-safe view of a game in progress (never private state).
export interface PublicGameSummary {
  gameType: string;
  phase: string;
  players: { id: string; name?: string; score?: number }[];
  headline?: string;
}

// What a single controller is allowed to see about its own situation.
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

// The logic core of a game adapter. Pure + serializable in/out so it is testable and AI-safe.
export interface GameAdapterCore {
  gameType: string;
  capabilities: GameCapabilities;
  getPublicSummary(state: unknown): PublicGameSummary;
  getPrivateSummary(state: unknown, playerId: string): PrivateGameSummary;
  getLegalActions(state: unknown, playerId: string): LegalAction[];
  explainRules(): string[];
  explainInvalidMove(reasonCode: string): string;
}
