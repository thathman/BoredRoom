import { describe, it, expect, beforeEach } from 'vitest';
import { persistenceAvailable } from '../../server/src/foundations';
import { hydrateFromRows, listQuestions, resetStore, isPlayable } from '../../server/src/content/moneyTriviaStore';

beforeEach(() => resetStore());

describe('Money Trivia persistence', () => {
  it('reports persistence unavailable when Supabase env is unset (so CRUD 503s)', () => {
    // No SUPABASE_URL / SERVICE_ROLE_KEY in the test env.
    expect(persistenceAvailable()).toBe(false);
  });

  it('hydrates owner-reviewed questions from database rows over the seed', async () => {
    const loaded = await hydrateFromRows([{
      id: 'mt-db-1', kind: 'hot_seat', prompt: 'A durably stored question?',
      options: ['Yes', 'No', 'Maybe', 'Never'], answer: 0, category: 'Meta',
      age_band: 'adult', difficulty: 3, explanation: 'Stored in DB.',
      source_url: 'https://example.org/x', review_status: 'approved', review_date: '2026-07-01',
    }]);
    expect(loaded).toBe(1);
    const q = listQuestions().find((x) => x.id === 'mt-db-1');
    expect(q).toBeDefined();
    expect(q!.reviewStatus).toBe('approved');
    expect(isPlayable(q!)).toBe(true);
  });
});
