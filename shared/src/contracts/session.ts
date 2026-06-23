// Session-aware platform contracts (Phase 1 Foundations).
//
// Canonical definitions live in BoredRoom-Spec/06-data-models/05-zod-schemas.md.
// These Zod schemas are the single source of truth; TS types are derived via z.infer.
// HouseSession is the true persistence unit; a GameRun is one play instance under it;
// a Colyseus room is the disposable realtime container for an active run.

import { z } from 'zod';

export const AgeRating = z.enum(['kids', 'family', 'teen', 'adult']);

const Id = z.string().min(1);
// Accept both Z-suffixed UTC (our writes) and timezone-offset form (Postgres timestamptz reads).
const Iso = z.string().datetime({ offset: true });

// --- HouseSession ----------------------------------------------------------
export const HouseSessionStatus = z.enum([
  'setup',
  'waiting_for_players',
  'walkthrough',
  'voting',
  'game_active',
  'recap',
  'next_decision',
  'paused',
  'ended',
  'recoverable',
]);

export const HouseSessionSettings = z.object({
  allowCrowdVotes: z.boolean().default(false), // O4 default; see clarifications
  allowBots: z.boolean().default(true),
  hintsEnabled: z.boolean().default(true),
  defaultHintBudget: z.number().int().nonnegative().default(3),
  moderationRequired: z.boolean().default(false),
  language: z.enum(['en', 'pcm']).default('en'),
  voteCooldownMs: z.number().int().nonnegative().default(15_000),
  maxControllers: z.number().int().positive().default(12),
});

export const HouseSession = z.object({
  id: Id,
  code: z.string().min(4),
  status: HouseSessionStatus,
  currentStage: z.string(),
  selectedPackIds: z.array(Id),
  activePackId: Id.optional(),
  hostDeviceId: Id,
  activeDisplayId: Id.optional(),
  activeOperatorIds: z.array(Id).default([]),
  currentGameRunId: Id.optional(),
  walkthroughCompleted: z.boolean().default(false),
  settings: HouseSessionSettings,
  createdAt: Iso,
  updatedAt: Iso,
  endedAt: Iso.optional(),
});

// --- GameRun ---------------------------------------------------------------
export const GameRunStatus = z.enum([
  'setup',
  'active',
  'paused',
  'finished',
  'abandoned',
  'recoverable',
]);

export const GameRun = z.object({
  id: Id,
  houseSessionId: Id,
  gameType: z.string(),
  packId: Id,
  roomCode: z.string().optional(),
  status: GameRunStatus,
  settings: z.record(z.unknown()).default({}),
  startedAt: Iso.optional(),
  endedAt: Iso.optional(),
  winnerPlayerIds: z.array(Id).optional(),
  recapId: Id.optional(),
  latestSnapshotId: Id.optional(),
});

// --- Devices (persist across sessions; O1/O2 open) -------------------------
export const ControllerDevice = z.object({
  id: Id, // stable localStorage device id (O1)
  displayName: z.string().min(1),
  lastSeenAt: Iso,
  pairedSessionIds: z.array(Id).default([]),
  playerProfileId: Id.optional(),
});

export const OperatorRole = z.enum(['host', 'co_host', 'scorekeeper', 'moderator']);

export const OperatorDevice = z.object({
  id: Id,
  sessionId: Id,
  role: OperatorRole,
  pairedAt: Iso,
  lastSeenAt: Iso,
});

// --- Session events --------------------------------------------------------
export const SessionEvent = z.object({
  id: Id,
  sessionId: Id,
  gameRunId: Id.optional(),
  type: z.string(), // e.g. "session.created", "vote.passed"
  actorId: Id.optional(),
  payload: z.record(z.unknown()).default({}),
  at: Iso,
});

// --- Vote / request engine (Phase 5) ---------------------------------------
export const ControllerRequest = z.object({
  id: Id,
  sessionId: Id,
  controllerId: Id,
  kind: z.enum(['start_game', 'switch_game', 'rematch', 'skip', 'custom']),
  targetGameType: z.string().optional(),
  createdAt: Iso,
});

export const HouseVoteStatus = z.enum([
  'gathering_support',
  'open',
  'passed',
  'failed',
  'expired',
]);

export const HouseVote = z.object({
  id: Id,
  sessionId: Id,
  requestId: Id.optional(),
  question: z.string(),
  options: z.array(z.string()).min(2),
  status: HouseVoteStatus,
  tally: z.record(z.number().int().nonnegative()).default({}),
  eligibleVoterIds: z.array(Id),
  openedAt: Iso.optional(),
  closesAt: Iso.optional(),
});

// --- Snapshots / recovery (Phase 10) ---------------------------------------
export const GameSnapshot = z.object({
  id: Id,
  gameRunId: Id,
  kind: z.enum(['full_state', 'event_replay']), // O3 open
  state: z.unknown(),
  takenAt: Iso,
});

export const RecoveryToken = z.object({
  token: z.string(),
  sessionId: Id,
  deviceId: Id,
  expiresAt: Iso,
});

// --- derived types ---------------------------------------------------------
export type AgeRating = z.infer<typeof AgeRating>;
export type HouseSessionStatus = z.infer<typeof HouseSessionStatus>;
export type HouseSessionSettings = z.infer<typeof HouseSessionSettings>;
export type HouseSession = z.infer<typeof HouseSession>;
export type GameRunStatus = z.infer<typeof GameRunStatus>;
export type GameRun = z.infer<typeof GameRun>;
export type ControllerDevice = z.infer<typeof ControllerDevice>;
export type OperatorRole = z.infer<typeof OperatorRole>;
export type OperatorDevice = z.infer<typeof OperatorDevice>;
export type SessionEvent = z.infer<typeof SessionEvent>;
export type ControllerRequest = z.infer<typeof ControllerRequest>;
export type HouseVoteStatus = z.infer<typeof HouseVoteStatus>;
export type HouseVote = z.infer<typeof HouseVote>;
export type GameSnapshot = z.infer<typeof GameSnapshot>;
export type RecoveryToken = z.infer<typeof RecoveryToken>;
