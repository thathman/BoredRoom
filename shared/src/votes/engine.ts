// Server-authoritative vote engine. It is intentionally pure and Colyseus-free so vote lifecycle,
// quorum, ties, expiry, and host override behavior can be tested without sockets.

import {
  HouseVote as HouseVoteSchema,
  HouseVoteSettings as HouseVoteSettingsSchema,
  type HouseVote,
  type HouseVoteResult,
  type HouseVoteSettings,
  type HouseVoteStatus,
  type HouseVoteType,
} from '../contracts/session.js';

export interface VoteRound {
  vote: HouseVote;
  // Kept server-side. Public projections expose tally/result, not individual ballots.
  ballots: Record<string, string>;
}

export interface VoteConfig {
  supportThreshold: number;
  durationMs: number;
}

export const DEFAULT_VOTE_CONFIG: VoteConfig = { supportThreshold: 2, durationMs: 30_000 };

export function canRequest(lastRequestAt: number | undefined, now: number, cooldownMs: number): boolean {
  if (!lastRequestAt) return true;
  return now - lastRequestAt >= cooldownMs;
}

function iso(now: number): string {
  return new Date(now).toISOString();
}

function recount(ballots: Record<string, string>, options: string[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const opt of options) tally[opt] = 0;
  for (const choice of Object.values(ballots)) {
    if (choice in tally) tally[choice] += 1;
  }
  return tally;
}

function castCount(tally: Record<string, number>): number {
  return Object.values(tally).reduce((sum, count) => sum + count, 0);
}

function leadingOptions(tally: Record<string, number>): { leaders: string[]; count: number } {
  let count = 0;
  let leaders: string[] = [];
  for (const [option, optionCount] of Object.entries(tally)) {
    if (optionCount > count) {
      count = optionCount;
      leaders = [option];
    } else if (optionCount === count && optionCount > 0) {
      leaders.push(option);
    }
  }
  return { leaders, count };
}

export function normaliseVoteSettings(settings?: Partial<HouseVoteSettings>): HouseVoteSettings {
  return HouseVoteSettingsSchema.parse(settings ?? {});
}

export function createVote(input: {
  id: string;
  sessionId: string;
  type?: HouseVoteType;
  question: string;
  options: string[];
  eligibleVoterIds: string[];
  createdBy?: string;
  settings?: Partial<HouseVoteSettings>;
  now: number;
}): VoteRound {
  const settings = normaliseVoteSettings(input.settings);
  const options = input.options.map((option) => option.trim()).filter(Boolean);
  const vote = HouseVoteSchema.parse({
    id: input.id,
    sessionId: input.sessionId,
    type: input.type ?? 'custom',
    question: input.question.trim(),
    options,
    status: 'open',
    tally: recount({}, options),
    eligibleVoterIds: Array.from(new Set(input.eligibleVoterIds)),
    settings,
    createdBy: input.createdBy,
    createdAt: iso(input.now),
    openedAt: iso(input.now),
    closesAt: iso(input.now + settings.timerMs),
  });
  return { vote, ballots: {} };
}

export function castVote(round: VoteRound, voterId: string, option: string, now: number): VoteRound {
  if (round.vote.status !== 'open') return round;
  if (isExpired(round, now)) return round;
  if (!round.vote.eligibleVoterIds.includes(voterId)) return round;
  if (!round.vote.options.includes(option)) return round;
  const ballots = { ...round.ballots, [voterId]: option };
  return { ...round, ballots, vote: { ...round.vote, tally: recount(ballots, round.vote.options) } };
}

export function closeVote(round: VoteRound, now: number): VoteRound {
  if (round.vote.status !== 'open') return round;
  return { ...round, vote: { ...round.vote, status: 'locked', closedAt: iso(now) } };
}

export function cancelVote(round: VoteRound, now: number): VoteRound {
  if (!['draft', 'open', 'locked'].includes(round.vote.status)) return round;
  return { ...round, vote: { ...round.vote, status: 'cancelled', cancelledAt: iso(now) } };
}

export function applyVote(round: VoteRound, now: number): VoteRound {
  if (round.vote.status !== 'resolved' || !round.vote.result) return round;
  const result: HouseVoteResult = {
    ...round.vote.result,
    applied: true,
    autoApplied: round.vote.settings.autoApply,
    status: 'applied',
  };
  return { ...round, vote: { ...round.vote, status: 'applied', appliedAt: iso(now), result } };
}

export function isExpired(round: VoteRound, now: number): boolean {
  return !!round.vote.closesAt && now >= Date.parse(round.vote.closesAt);
}

export function resolveVote(
  round: VoteRound,
  now: number,
  hostOverride?: { actorId: string; option: string; reason?: string },
): VoteRound {
  if (!['open', 'locked'].includes(round.vote.status)) return round;
  if (hostOverride && !round.vote.settings.hostOverrideAllowed) return round;
  if (hostOverride && !round.vote.options.includes(hostOverride.option)) return round;

  const tally = round.vote.tally;
  const eligibleVoterCount = round.vote.eligibleVoterIds.length;
  const totalCast = castCount(tally);
  const quorumMet = totalCast >= round.vote.settings.quorum;
  const { leaders, count } = leadingOptions(tally);
  const tied = leaders.length > 1;
  const thresholdCount = Math.max(1, Math.floor(eligibleVoterCount * round.vote.settings.majorityThreshold) + 1);
  const thresholdMet = count >= thresholdCount;
  const expired = isExpired(round, now);
  const winnerOption = hostOverride
    ? hostOverride.option
    : quorumMet && thresholdMet && !tied
      ? leaders[0]
      : null;
  if (!winnerOption && round.vote.status === 'open' && !expired) {
    return round;
  }
  const status: HouseVoteStatus = expired && !winnerOption && round.vote.status === 'open'
    ? 'expired'
    : 'resolved';
  const result: HouseVoteResult = {
    voteId: round.vote.id,
    voteType: round.vote.type,
    winnerOption,
    voteCounts: { ...tally },
    eligibleVoterCount,
    castCount: totalCast,
    quorumMet,
    tied,
    tiedOptions: tied ? leaders : [],
    applied: false,
    autoApplied: false,
    status,
    hostOverride: hostOverride
      ? {
          actorId: hostOverride.actorId,
          option: hostOverride.option,
          reason: hostOverride.reason,
          at: iso(now),
        }
      : undefined,
    resolvedAt: iso(now),
  };
  return {
    ...round,
    vote: {
      ...round.vote,
      status,
      resolvedAt: iso(now),
      result,
    },
  };
}

export function winningOption(round: VoteRound): string | null {
  return round.vote.result?.winnerOption ?? null;
}
