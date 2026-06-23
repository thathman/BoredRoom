// Vote & request engine (Phase 5) — pure, Colyseus-free, easy to unit-test.
//
// Flow: a controller raises a ControllerRequest -> it gathers support -> at threshold it opens as a
// HouseVote -> eligible voters cast ballots -> majority (or expiry) resolves it. Majority governs
// session/game decisions unless a host override is used (constitution Art. III.1). Cooldowns reuse
// the same time-window idea as the reaction policy to stop request spam.

import type { HouseVote, HouseVoteStatus } from '../contracts/session.js';

export interface VoteRound {
  vote: HouseVote;
  // Controllers backing the request while it gathers support.
  supporters: string[];
  // Who voted for what, so a voter can't double-count. Not part of the public vote shape.
  ballots: Record<string, string>;
}

export interface VoteConfig {
  supportThreshold: number; // supporters needed to open the vote
  durationMs: number; // voting window once open
}

export const DEFAULT_VOTE_CONFIG: VoteConfig = { supportThreshold: 2, durationMs: 30_000 };

// Per-controller request cooldown (mirrors reaction cooldown semantics).
export function canRequest(lastRequestAt: number | undefined, now: number, cooldownMs: number): boolean {
  if (!lastRequestAt) return true;
  return now - lastRequestAt >= cooldownMs;
}

function recount(ballots: Record<string, string>, options: string[]): Record<string, number> {
  const tally: Record<string, number> = {};
  for (const opt of options) tally[opt] = 0;
  for (const choice of Object.values(ballots)) {
    if (choice in tally) tally[choice] += 1;
  }
  return tally;
}

// Open a request as a vote round in the gathering-support stage. The raising controller is the
// first supporter.
export function openRound(input: {
  vote: Omit<HouseVote, 'status' | 'tally' | 'openedAt' | 'closesAt'>;
  raisedBy: string;
}): VoteRound {
  return {
    vote: {
      ...input.vote,
      status: 'gathering_support',
      tally: recount({}, input.vote.options),
    },
    supporters: [input.raisedBy],
    ballots: {},
  };
}

// Add support. Once the threshold is met the round opens for voting with a closing time.
export function addSupport(
  round: VoteRound,
  controllerId: string,
  config: VoteConfig,
  now: number,
): VoteRound {
  if (round.vote.status !== 'gathering_support') return round;
  const supporters = round.supporters.includes(controllerId)
    ? round.supporters
    : [...round.supporters, controllerId];
  if (supporters.length >= config.supportThreshold) {
    return {
      ...round,
      supporters,
      vote: {
        ...round.vote,
        status: 'open',
        openedAt: new Date(now).toISOString(),
        closesAt: new Date(now + config.durationMs).toISOString(),
      },
    };
  }
  return { ...round, supporters };
}

// Cast (or change) a ballot. Ignored unless the vote is open, the voter is eligible, and the option
// is valid.
export function castVote(round: VoteRound, voterId: string, option: string, now: number): VoteRound {
  if (round.vote.status !== 'open') return round;
  if (isExpired(round, now)) return round;
  if (!round.vote.eligibleVoterIds.includes(voterId)) return round;
  if (!round.vote.options.includes(option)) return round;
  const ballots = { ...round.ballots, [voterId]: option };
  return { ...round, ballots, vote: { ...round.vote, tally: recount(ballots, round.vote.options) } };
}

export function isExpired(round: VoteRound, now: number): boolean {
  return !!round.vote.closesAt && now >= Date.parse(round.vote.closesAt);
}

// Resolve the round: a strict majority of eligible voters passes the leading option; an expired
// window without majority fails. Returns the updated round (status passed/failed/expired/open).
export function resolveRound(round: VoteRound, now: number): VoteRound {
  if (round.vote.status !== 'open') return round;
  const tally = round.vote.tally;
  const total = round.vote.eligibleVoterIds.length;
  const majority = Math.floor(total / 2) + 1;

  let leader: string | null = null;
  let leadCount = 0;
  for (const [opt, count] of Object.entries(tally) as [string, number][]) {
    if (count > leadCount) {
      leader = opt;
      leadCount = count;
    }
  }

  let status: HouseVoteStatus = round.vote.status;
  if (leader && leadCount >= majority) {
    status = 'passed';
  } else if (isExpired(round, now)) {
    status = 'failed';
  }
  if (status === round.vote.status) return round;
  return { ...round, vote: { ...round.vote, status } };
}

export function winningOption(round: VoteRound): string | null {
  if (round.vote.status !== 'passed') return null;
  let leader: string | null = null;
  let leadCount = -1;
  for (const [opt, count] of Object.entries(round.vote.tally) as [string, number][]) {
    if (count > leadCount) {
      leader = opt;
      leadCount = count;
    }
  }
  return leader;
}
