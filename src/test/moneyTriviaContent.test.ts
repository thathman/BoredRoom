import { describe, it, expect, beforeEach } from 'vitest';
import {
  validateQuestion, listQuestions, createDraft, updateQuestion, deleteQuestion,
  selectRunContent, resetStore, isPlayable,
} from '../../server/src/content/moneyTriviaStore';
import { MONEY_TRIVIA_SEED } from '../../server/src/content/moneyTriviaBank';

const VALID = {
  prompt: 'Which ocean borders Lagos?',
  options: ['Atlantic', 'Pacific', 'Indian', 'Arctic'] as [string, string, string, string],
  answer: 0,
  category: 'Geography',
  ageBand: 'adult' as const,
  difficulty: 3,
  explanation: 'Lagos sits on the Atlantic coast.',
  sourceUrl: 'https://en.wikipedia.org/wiki/Lagos',
};

beforeEach(() => resetStore());

describe('Money Trivia seed bank', () => {
  it('ships at least 225 approved questions, 5 per level across 3 age bands', () => {
    expect(MONEY_TRIVIA_SEED.length).toBeGreaterThanOrEqual(225);
    for (const band of ['pre_teen', 'teen', 'adult']) {
      for (let level = 1; level <= 15; level += 1) {
        const count = MONEY_TRIVIA_SEED.filter((q) => q.ageBand === band && q.difficulty === level && q.reviewStatus === 'approved').length;
        expect(count, `${band} L${level}`).toBeGreaterThanOrEqual(5);
      }
    }
  });

  it('every seed question carries source, explanation, review status and date', () => {
    for (const q of MONEY_TRIVIA_SEED) {
      expect(q.sourceUrl).toMatch(/^https?:\/\//);
      expect(q.reviewStatus).toBe('approved');
      expect(q.reviewDate).toMatch(/^\d{4}-\d{2}-\d{2}$/);
      expect(q.options).toHaveLength(4);
    }
  });
});

describe('validateQuestion rejects bad content', () => {
  it('accepts a well-formed sourced question', () => {
    expect(validateQuestion(VALID).ok).toBe(true);
  });
  it('rejects malformed options', () => {
    expect(validateQuestion({ ...VALID, options: ['a', 'b'] as never }).errors).toContain('options_must_be_four_nonempty');
  });
  it('rejects a missing/invalid source', () => {
    expect(validateQuestion({ ...VALID, sourceUrl: 'not-a-url' }).errors).toContain('missing_or_invalid_source');
  });
  it('rejects an out-of-range difficulty tier', () => {
    expect(validateQuestion({ ...VALID, difficulty: 99 }).errors).toContain('difficulty_out_of_range');
  });
  it('rejects an invalid age band', () => {
    expect(validateQuestion({ ...VALID, ageBand: 'baby' as never }).errors).toContain('invalid_age_band');
  });
  it('rejects a duplicate prompt of an existing question', () => {
    const seed = MONEY_TRIVIA_SEED[0];
    expect(validateQuestion({ ...VALID, prompt: seed.prompt }).errors).toContain('duplicate_prompt');
  });
  it('rejects an invalid expiry date', () => {
    expect(validateQuestion({ ...VALID, expiry: 'whenever' }).errors).toContain('invalid_expiry_date');
  });
});

describe('approval workflow', () => {
  it('a draft is created un-playable, then becomes playable only after approval', () => {
    const { question } = createDraft(VALID);
    expect(question?.reviewStatus).toBe('draft');
    expect(isPlayable(question!)).toBe(false);
    const updated = updateQuestion(question!.id, { reviewStatus: 'approved' });
    expect(updated.question?.reviewStatus).toBe('approved');
    expect(isPlayable(updated.question!)).toBe(true);
  });
  it('an expired approved question is not playable', () => {
    const { question } = createDraft({ ...VALID, expiry: '2000-01-01' });
    updateQuestion(question!.id, { reviewStatus: 'approved' });
    expect(isPlayable(listQuestions().find((q) => q.id === question!.id)!)).toBe(false);
  });
  it('retiring a question removes it from playable selection', () => {
    deleteQuestion(MONEY_TRIVIA_SEED[0].id);
    expect(listQuestions().some((q) => q.id === MONEY_TRIVIA_SEED[0].id)).toBe(false);
  });
});

describe('run selection', () => {
  it('returns 15 ascending-difficulty questions plus fastest-finger spares for each band', () => {
    for (const ageBand of ['pre_teen', 'teen', 'adult'] as const) {
      const run = selectRunContent({ ageBand }, () => 0);
      expect(run.ok).toBe(true);
      const ladder = run.questions!.slice(0, 15);
      expect(ladder.map((q) => q.difficulty)).toEqual([1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15]);
      expect(run.questions!.length).toBeGreaterThan(15); // spares for fastest finger
      expect(ladder.every((q) => q.ageBand === ageBand && q.reviewStatus === 'approved')).toBe(true);
    }
  });

  it('blocks setup (does not silently widen) when a level lacks approved content', () => {
    // Retire every adult level-7 question.
    for (const q of listQuestions({ ageBand: 'adult' })) {
      if (q.difficulty === 7) deleteQuestion(q.id);
    }
    const run = selectRunContent({ ageBand: 'adult' });
    expect(run.ok).toBe(false);
    expect(run.reason).toBe('insufficient_approved_questions_level_7');
  });
});
