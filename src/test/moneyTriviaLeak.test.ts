import { describe, it, expect } from 'vitest';
import {
  deleteSession,
  getInternalActiveRun,
  getPublicSession,
  issueOwnerCredential,
  publicGameRun,
  registerSession,
  selectSessionGame,
} from '../../server/src/sessionDirectory';
import { buildHouseSession } from '../../server/src/foundations';
import { selectRunContent } from '../../server/src/content/moneyTriviaStore';
import type { GameRun } from '../../shared/src/contracts/session';

// The public GameRun projection must never carry questions, answer indexes or other runtime-private
// content. This is the chokepoint every session:state / GET /sessions response passes through.
describe('public GameRun projection (answer-leak guard)', () => {
  const content = selectRunContent({ ageBand: 'adult' }, () => 0);
  const run: GameRun = {
    id: 'run-1',
    houseSessionId: 'house-1',
    gameType: 'trivia',
    gameVersion: '1.7.0.0',
    status: 'active',
    settings: {
      ageBand: 'adult',
      questions: content.questions, // contains prompts, options AND answer indexes
      aiContent: false,
      hostFundedConfirmed: true,
      topPrize: 5000,
    },
    result: { pledgedPrize: 5000, earnedAmount: 0, outcome: 'walked_away', currency: 'NGN', settlementStatus: 'unsettled' },
  };

  it('strips questions and answers from settings', () => {
    const projected = publicGameRun(run);
    expect(projected.settings.questions).toBeUndefined();
    expect(projected.settings.ageBand).toBe('adult'); // safe settings preserved
    expect(projected.settings.topPrize).toBe(5000);
  });

  it('leaks no answer index or correct-answer marker anywhere in the projection', () => {
    const json = JSON.stringify(publicGameRun(run));
    expect(json.includes('"answer"')).toBe(false);
    // None of the real questions' option text should be reachable from the public run.
    const anyQuestion = content.questions![0];
    expect(json.includes(anyQuestion.prompt)).toBe(false);
  });

  it('keeps the safe payout result (no answers) for recap/history', () => {
    const projected = publicGameRun(run);
    expect(projected.result?.settlementStatus).toBe('unsettled');
    expect(projected.result?.earnedAmount).toBe(0);
  });

  it('does not mutate the original run settings', () => {
    publicGameRun(run);
    expect((run.settings.questions as unknown[]).length).toBeGreaterThan(0);
  });

  it('keeps private runtime settings available after the public run is redacted', () => {
    const session = buildHouseSession({ hostDeviceId: 'money-runtime-host' });
    registerSession(session, issueOwnerCredential());
    selectSessionGame(session.code, structuredClone(run));

    expect(getPublicSession(session.code)?.activeRun?.settings.questions).toBeUndefined();
    expect((getInternalActiveRun(session.code)?.settings.questions as unknown[])).toHaveLength(15);

    deleteSession(session.code);
  });
});
