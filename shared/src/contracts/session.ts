// Session-aware platform contracts (Phase 1 Foundations).
//
// Canonical definitions live in BoredRoom-Spec/06-data-models/05-zod-schemas.md.
// These Zod schemas are the single source of truth; TS types are derived via z.infer.
// HouseSession is the true persistence unit; a GameRun is one play instance under it;
// HouseSessionRoom is the only realtime container; installed game runtimes execute inside it.

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
  hostDeviceId: Id,
  activeDisplayId: Id.optional(),
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
  gameVersion: z.string().regex(/^\d+\.\d+\.\d+\.\d+$/),
  status: GameRunStatus,
  settings: z.record(z.string(), z.unknown()).default({}),
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

// --- Session events --------------------------------------------------------
export const SessionEvent = z.object({
  id: Id,
  sessionId: Id,
  gameRunId: Id.optional(),
  type: z.string(), // e.g. "session.created", "vote.passed"
  actorId: Id.optional(),
  payload: z.record(z.string(), z.unknown()).default({}),
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
  'draft',
  'open',
  'locked',
  'resolved',
  'applied',
  'cancelled',
  'expired',
  'archived',
]);

export const HouseVoteType = z.enum([
  'game_selection',
  'pause_game',
  'resume_game',
  'skip_round',
  'replay_round',
  'end_game',
  'rematch',
  'next_game',
  'admit_player',
  'kick_player',
  'remote_mode',
  'team_change',
  'end_party',
  'custom',
]);

export const HouseVoteTieBreakRule = z.enum([
  'host_decides',
  'random',
  'runoff',
  'no_action',
]);

export const HouseVoteSettings = z.object({
  anonymous: z.boolean().default(false),
  majorityThreshold: z.number().min(0).max(1).default(0.5),
  quorum: z.number().int().nonnegative().default(1),
  allowCrowdVotes: z.boolean().default(false),
  timerMs: z.number().int().positive().default(30_000),
  tieBreakRule: HouseVoteTieBreakRule.default('host_decides'),
  hostOverrideAllowed: z.boolean().default(true),
  autoApply: z.boolean().default(false),
});

const DEFAULT_HOUSE_VOTE_SETTINGS = {
  anonymous: false,
  majorityThreshold: 0.5,
  quorum: 1,
  allowCrowdVotes: false,
  timerMs: 30_000,
  tieBreakRule: 'host_decides' as const,
  hostOverrideAllowed: true,
  autoApply: false,
};

export const HouseVoteResult = z.object({
  voteId: Id,
  voteType: HouseVoteType,
  winnerOption: z.string().nullable(),
  voteCounts: z.record(z.string(), z.number().int().nonnegative()),
  eligibleVoterCount: z.number().int().nonnegative(),
  castCount: z.number().int().nonnegative(),
  quorumMet: z.boolean(),
  tied: z.boolean(),
  tiedOptions: z.array(z.string()).default([]),
  applied: z.boolean().default(false),
  autoApplied: z.boolean().default(false),
  status: HouseVoteStatus,
  hostOverride: z.object({
    actorId: Id,
    option: z.string(),
    reason: z.string().optional(),
    at: Iso,
  }).optional(),
  resolvedAt: Iso,
});

export const HouseVote = z.object({
  id: Id,
  sessionId: Id,
  requestId: Id.optional(),
  type: HouseVoteType.default('custom'),
  question: z.string(),
  options: z.array(z.string()).min(2),
  status: HouseVoteStatus,
  tally: z.record(z.string(), z.number().int().nonnegative()).default({}),
  eligibleVoterIds: z.array(Id),
  settings: HouseVoteSettings.default(DEFAULT_HOUSE_VOTE_SETTINGS),
  createdBy: Id.optional(),
  createdAt: Iso,
  openedAt: Iso.optional(),
  closesAt: Iso.optional(),
  closedAt: Iso.optional(),
  resolvedAt: Iso.optional(),
  appliedAt: Iso.optional(),
  cancelledAt: Iso.optional(),
  result: HouseVoteResult.optional(),
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
export type SessionEvent = z.infer<typeof SessionEvent>;
export type ControllerRequest = z.infer<typeof ControllerRequest>;
export type HouseVoteStatus = z.infer<typeof HouseVoteStatus>;
export type HouseVoteType = z.infer<typeof HouseVoteType>;
export type HouseVoteSettings = z.infer<typeof HouseVoteSettings>;
export type HouseVoteResult = z.infer<typeof HouseVoteResult>;
export type HouseVote = z.infer<typeof HouseVote>;
export type GameSnapshot = z.infer<typeof GameSnapshot>;
export type RecoveryToken = z.infer<typeof RecoveryToken>;
