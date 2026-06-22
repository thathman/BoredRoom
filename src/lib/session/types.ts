// ============================================================
// BoredRoom — Phase 1: Core Session & Device Types
// Source of truth: BoredRoom-Spec/06-data-models
// ============================================================

// ----------------------------------------------------------------
// House Session
// ----------------------------------------------------------------

export type HouseSessionStatus =
  | "setup"
  | "waiting_for_players"
  | "walkthrough"
  | "voting"
  | "game_active"
  | "recap"
  | "next_decision"
  | "paused"
  | "ended"
  | "abandoned"
  | "recoverable";

export type HouseStage =
  | "pack_select"
  | "preset_select"
  | "house_rules"
  | "display_setup"
  | "review"
  | "player_lobby"
  | "walkthrough"
  | "game"
  | "recap"
  | "next_decision";

export interface HouseSessionSettings {
  maxPlayers: number;
  allowSpectators: boolean;
  requireModerationApproval: boolean;
  hintsEnabled: boolean;
  hintLimit: number;
  botsAllowed: boolean;
  autoAdvance: boolean;
  language: string;
  customRules?: Record<string, unknown>;
}

export interface HouseSession {
  id: string;
  code: string;
  status: HouseSessionStatus;
  currentStage: HouseStage;
  selectedPackIds: string[];
  activePackId?: string;
  hostDeviceId: string;
  activeDisplayId?: string;
  activeOperatorIds: string[];
  currentGameRunId?: string;
  walkthroughCompleted: boolean;
  settings: HouseSessionSettings;
  createdAt: string;
  updatedAt: string;
  endedAt?: string;
}

// ----------------------------------------------------------------
// Game Run
// ----------------------------------------------------------------

export type GameRunStatus =
  | "setup"
  | "active"
  | "paused"
  | "finished"
  | "abandoned"
  | "recoverable";

export interface GameRun {
  id: string;
  houseSessionId: string;
  gameType: string;
  packId: string;
  roomCode?: string;
  roomId?: string;
  status: GameRunStatus;
  settings: Record<string, unknown>;
  startedAt?: string;
  endedAt?: string;
  winnerPlayerIds?: string[];
  recapId?: string;
  latestSnapshotId?: string;
}

// ----------------------------------------------------------------
// Session Event
// ----------------------------------------------------------------

export type SessionEventType =
  | "session_created"
  | "session_resumed"
  | "session_ended"
  | "game_run_started"
  | "game_run_finished"
  | "game_run_abandoned"
  | "player_joined"
  | "player_left"
  | "player_seat_recovered"
  | "vote_cast"
  | "vote_resolved"
  | "operator_paired"
  | "operator_revoked"
  | "host_transferred"
  | "pack_selected"
  | "stage_changed"
  | "settings_changed"
  | "rematch_requested"
  | "bot_added"
  | "bot_removed";

export interface SessionEvent {
  id: string;
  houseSessionId: string;
  gameRunId?: string;
  type: SessionEventType;
  actorDeviceId?: string;
  payload?: Record<string, unknown>;
  createdAt: string;
}

// ----------------------------------------------------------------
// Controller Device
// ----------------------------------------------------------------

export interface ControllerDevice {
  id: string;
  fingerprintVersion: string;
  displayName?: string;
  avatar?: string;
  color?: string;
  preferredLanguage?: string;
  accessibilitySettings?: Record<string, unknown>;
  privateAgentId?: string;
  createdAt: string;
  lastSeenAt: string;
}

export type SeatRecoveryMethod =
  | "transfer_code"
  | "host_approval"
  | "recovery_pin"
  | "majority_confirmation"
  | "disconnected_seat_timeout";

// ----------------------------------------------------------------
// Operator Device
// ----------------------------------------------------------------

export type OperatorRole =
  | "owner_host"
  | "co_host"
  | "moderator"
  | "settings_manager"
  | "content_manager"
  | "read_only_observer";

export type OperatorPairingMethod =
  | "qr"
  | "six_digit_code"
  | "host_approval"
  | "login"
  | "recovery_pin";

export interface OperatorDevice {
  id: string;
  houseSessionId: string;
  deviceId: string;
  role: OperatorRole;
  pairingMethod: OperatorPairingMethod;
  displayName?: string;
  pairedAt: string;
  lastActiveAt: string;
  revokedAt?: string;
}

// ----------------------------------------------------------------
// Shared helpers
// ----------------------------------------------------------------

export const DEFAULT_SESSION_SETTINGS: HouseSessionSettings = {
  maxPlayers: 12,
  allowSpectators: true,
  requireModerationApproval: false,
  hintsEnabled: true,
  hintLimit: 3,
  botsAllowed: true,
  autoAdvance: false,
  language: "en",
};
