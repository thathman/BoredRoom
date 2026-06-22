// ============================================================
// BoredRoom — Game Adapter Contract
// Source of truth: BoredRoom-Spec/07-technical-architecture/01-game-adapter-contract.md
//
// Every game must implement this interface.
// This contract powers:
//   - setup wizard
//   - controller shell
//   - AI rule assistant
//   - hint engine
//   - recaps
//   - audience mode
//   - snapshot restore
//   - game recommendations
// ============================================================

import type { ComponentType } from "react";

export interface PublicGameSummary {
  phase: string;
  round?: number;
  totalRounds?: number;
  scores?: Record<string, number>;
  currentPlayerId?: string;
  timerEndsAt?: string;
  displayMessage?: string;
}

export interface PrivateGameSummary {
  playerId: string;
  hand?: unknown[];
  availableActions?: string[];
  privateMessage?: string;
  hintsRemaining?: number;
}

export interface LegalAction {
  type: string;
  label: string;
  payload?: Record<string, unknown>;
  disabled?: boolean;
  disabledReason?: string;
}

export interface GameAdapter {
  gameType: string;
  packId: string;

  // React components — each screen type
  Display: ComponentType<{ state: unknown; sessionCode: string }>;
  Controller: ComponentType<{ state: PrivateGameSummary; onAction: (action: LegalAction) => void }>;
  Setup: ComponentType<{ onComplete: (settings: Record<string, unknown>) => void }>;
  Recap: ComponentType<{ gameRunId: string }>;

  // Capability declarations
  getPlayerCountRange(): { min: number; max: number };
  supportsBots(): boolean;
  supportsAudience(): boolean;
  supportsHints(): boolean;
  supportsVoice(): boolean;
  supportsRestore(): boolean;

  // State projections — public/private boundary
  getPublicSummary(state: unknown): PublicGameSummary;
  getPrivateSummary(state: unknown, playerId: string): PrivateGameSummary;
  getLegalActions(state: unknown, playerId: string): LegalAction[];

  // AI/rule tools
  explainRules(context?: unknown): string[];
  explainInvalidMove(reasonCode: string): string;
}
