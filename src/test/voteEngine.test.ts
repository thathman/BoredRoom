import { describe, expect, it } from 'vitest';
import {
  applyVote,
  cancelVote,
  canRequest,
  castVote,
  closeVote,
  createVote,
  DEFAULT_VOTE_CONFIG,
  isExpired,
  resolveVote,
  winningOption,
  type VoteRound,
} from '../../shared/src/votes/engine';

const T0 = 1_000_000;

function newRound(eligible: string[], settings = {}): VoteRound {
  return createVote({
    id: 'v1',
    sessionId: 's1',
    type: 'game_selection',
    question: 'Next game?',
    options: ['Whot', 'Ludo'],
    eligibleVoterIds: eligible,
    createdBy: 'host',
    settings: { timerMs: 1000, quorum: 1, ...settings },
    now: T0,
  });
}

describe('vote engine', () => {
  it('opens with a timed, typed public vote', () => {
    const r = newRound(['c1', 'c2']);
    expect(r.vote.status).toBe('open');
    expect(r.vote.type).toBe('game_selection');
    expect(r.vote.tally).toEqual({ Whot: 0, Ludo: 0 });
    expect(r.vote.openedAt).toBe(new Date(T0).toISOString());
    expect(r.vote.closesAt).toBe(new Date(T0 + 1000).toISOString());
    expect(r.ballots).toEqual({});
  });

  it('resolves to a winner only when quorum and threshold are met without a tie', () => {
    let r = newRound(['c1', 'c2', 'c3']);
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = castVote(r, 'c2', 'Whot', T0 + 2);
    r = resolveVote(r, T0 + 3);
    expect(r.vote.status).toBe('resolved');
    expect(winningOption(r)).toBe('Whot');
    expect(r.vote.result).toMatchObject({
      winnerOption: 'Whot',
      eligibleVoterCount: 3,
      castCount: 2,
      quorumMet: true,
      tied: false,
      applied: false,
    });
  });

  it('keeps an open vote open when no option has won yet', () => {
    let r = newRound(['c1', 'c2', 'c3']);
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = resolveVote(r, T0 + 2);
    expect(r.vote.status).toBe('open');
    expect(r.vote.result).toBeUndefined();
  });

  it('ignores ineligible voters and invalid options', () => {
    let r = newRound(['c1', 'c2']);
    r = castVote(r, 'stranger', 'Whot', T0 + 1);
    r = castVote(r, 'c1', 'Market', T0 + 1);
    expect(r.vote.tally).toEqual({ Whot: 0, Ludo: 0 });
  });

  it('a voter can change their ballot without double-counting', () => {
    let r = newRound(['c1', 'c2', 'c3']);
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = castVote(r, 'c1', 'Ludo', T0 + 2);
    expect(r.vote.tally).toEqual({ Whot: 0, Ludo: 1 });
  });

  it('expires without a winner when quorum or threshold is not met', () => {
    let r = newRound(['c1', 'c2', 'c3', 'c4'], { quorum: 3 });
    r = castVote(r, 'c1', 'Whot', T0 + 10);
    expect(isExpired(r, T0 + 10)).toBe(false);
    r = resolveVote(r, T0 + 2000);
    expect(r.vote.status).toBe('expired');
    expect(r.vote.result?.quorumMet).toBe(false);
    expect(winningOption(r)).toBeNull();
  });

  it('rejects votes after expiry', () => {
    const r = newRound(['c1', 'c2']);
    const after = castVote(r, 'c1', 'Whot', T0 + 5000);
    expect(after.vote.tally.Whot).toBe(0);
  });

  it('locks before resolving when the host closes voting', () => {
    let r = newRound(['c1', 'c2']);
    r = castVote(r, 'c1', 'Whot', T0 + 10);
    r = closeVote(r, T0 + 20);
    expect(r.vote.status).toBe('locked');
    r = resolveVote(r, T0 + 21);
    expect(r.vote.status).toBe('resolved');
  });

  it('records ties in the result', () => {
    let r = newRound(['c1', 'c2'], { majorityThreshold: 0 });
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = castVote(r, 'c2', 'Ludo', T0 + 2);
    r = closeVote(r, T0 + 3);
    r = resolveVote(r, T0 + 4);
    expect(r.vote.status).toBe('resolved');
    expect(r.vote.result?.tied).toBe(true);
    expect(r.vote.result?.tiedOptions).toEqual(['Whot', 'Ludo']);
    expect(winningOption(r)).toBeNull();
  });

  it('allows an authorized host override when configured', () => {
    let r = newRound(['c1', 'c2'], { hostOverrideAllowed: true });
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = resolveVote(r, T0 + 2, { actorId: 'host', option: 'Ludo', reason: 'Host picked faster game.' });
    expect(r.vote.status).toBe('resolved');
    expect(winningOption(r)).toBe('Ludo');
    expect(r.vote.result?.hostOverride?.actorId).toBe('host');
  });

  it('applies a resolved result once', () => {
    let r = newRound(['c1']);
    r = castVote(r, 'c1', 'Whot', T0 + 1);
    r = resolveVote(r, T0 + 2);
    r = applyVote(r, T0 + 3);
    expect(r.vote.status).toBe('applied');
    expect(r.vote.result?.applied).toBe(true);
  });

  it('cancels open or locked votes', () => {
    const r = cancelVote(newRound(['c1']), T0 + 1);
    expect(r.vote.status).toBe('cancelled');
    expect(r.vote.cancelledAt).toBe(new Date(T0 + 1).toISOString());
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
