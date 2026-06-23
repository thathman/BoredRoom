import { describe, expect, it } from 'vitest';
import {
  openRound,
  addSupport,
  castVote,
  resolveRound,
  winningOption,
  canRequest,
  isExpired,
  DEFAULT_VOTE_CONFIG,
  type VoteRound,
} from '../../shared/src/votes/engine';

const config = { supportThreshold: 2, durationMs: 1000 };
const T0 = 1_000_000;

function newRound(eligible: string[]): VoteRound {
  return openRound({
    vote: {
      id: 'v1',
      sessionId: 's1',
      question: 'Switch to Whot?',
      options: ['yes', 'no'],
      eligibleVoterIds: eligible,
    },
    raisedBy: 'c1',
  });
}

// AC-5.1 / AC-5.2: request gathers support, opens, passes on majority, respects cooldown/expiry.
describe('vote engine', () => {
  it('gathers support then opens at threshold', () => {
    let r = newRound(['c1', 'c2', 'c3']);
    expect(r.vote.status).toBe('gathering_support');
    expect(r.supporters).toEqual(['c1']);
    r = addSupport(r, 'c1', config, T0); // dup supporter ignored
    expect(r.vote.status).toBe('gathering_support');
    r = addSupport(r, 'c2', config, T0); // reaches threshold 2
    expect(r.vote.status).toBe('open');
    expect(r.vote.openedAt).toBeDefined();
    expect(r.vote.closesAt).toBeDefined();
  });

  it('passes on strict majority of eligible voters', () => {
    let r = addSupport(newRound(['c1', 'c2', 'c3']), 'c2', config, T0);
    r = castVote(r, 'c1', 'yes', T0 + 1);
    r = castVote(r, 'c2', 'yes', T0 + 2); // 2 of 3 = majority
    r = resolveRound(r, T0 + 3);
    expect(r.vote.status).toBe('passed');
    expect(winningOption(r)).toBe('yes');
  });

  it('ignores ineligible voters and invalid options', () => {
    let r = addSupport(newRound(['c1', 'c2']), 'c2', config, T0);
    r = castVote(r, 'stranger', 'yes', T0 + 1);
    r = castVote(r, 'c1', 'maybe', T0 + 1);
    expect(r.vote.tally).toEqual({ yes: 0, no: 0 });
  });

  it('a voter can change their ballot without double-counting', () => {
    let r = addSupport(newRound(['c1', 'c2', 'c3']), 'c2', config, T0);
    r = castVote(r, 'c1', 'yes', T0 + 1);
    r = castVote(r, 'c1', 'no', T0 + 2);
    expect(r.vote.tally).toEqual({ yes: 0, no: 1 });
  });

  it('fails when the window expires without majority', () => {
    let r = addSupport(newRound(['c1', 'c2', 'c3', 'c4']), 'c2', config, T0);
    r = castVote(r, 'c1', 'yes', T0 + 10);
    expect(isExpired(r, T0 + 10)).toBe(false);
    r = resolveRound(r, T0 + 2000); // past closesAt
    expect(r.vote.status).toBe('failed');
  });

  it('rejects votes after expiry', () => {
    const r = addSupport(newRound(['c1', 'c2']), 'c2', config, T0);
    const after = castVote(r, 'c1', 'yes', T0 + 5000);
    expect(after.vote.tally.yes).toBe(0);
  });

  it('enforces request cooldown', () => {
    expect(canRequest(undefined, T0, 15_000)).toBe(true);
    expect(canRequest(T0, T0 + 5_000, 15_000)).toBe(false);
    expect(canRequest(T0, T0 + 15_000, 15_000)).toBe(true);
  });

  it('ships sane defaults', () => {
    expect(DEFAULT_VOTE_CONFIG.supportThreshold).toBeGreaterThan(0);
    expect(DEFAULT_VOTE_CONFIG.durationMs).toBeGreaterThan(0);
  });
});
