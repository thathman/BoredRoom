export interface GameCapabilities {
  playerCount: { min: number; max: number };
  bots: boolean;
  audience: boolean;
  hints: boolean;
  voice: boolean;
  restore: boolean;
}

export interface GameRuntimeContext {
  sessionId: string;
  gameRunId: string;
  settings: Record<string, unknown>;
}

export interface GameRuntimePlayer {
  id: string;
  name: string;
}

export interface GameRuntimeMetadata {
  gameType: string;
  capabilities: GameCapabilities;
  rules?: {
    summary: string;
    intents: string[];
  };
}

export interface GameRuntime {
  readonly gameType: string;
  readonly metadata: GameRuntimeMetadata;
  configure(context: GameRuntimeContext): void;
  seatPlayers(players: GameRuntimePlayer[]): void;
  start(): void;
  handleIntent(playerId: string, intent: Record<string, unknown>, isHost: boolean): boolean;
  publicState(): unknown;
  privateState(playerId: string): unknown;
  companionState(): unknown;
  crowdState(): unknown;
  snapshot(): unknown;
  restore(snapshot: unknown): void;
  legalIntents?(playerId: string): Array<Record<string, unknown>>;
  explainIntent?(intent: Record<string, unknown>): string;
  recapSignals?(): Record<string, unknown>;
  finish(): { winnerPlayerIds: string[] };
  dispose(): void;
}
