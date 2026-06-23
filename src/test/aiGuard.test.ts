import { describe, expect, it } from 'vitest';
import {
  validateProposal,
  createHintWallet,
  spendHint,
  earnHint,
  canSpendHint,
  hintsRemaining,
} from '../../shared/src/ai/guard';
import type { LegalAction } from '../../shared/src/contracts/adapter';

const legal: LegalAction[] = [
  { type: 'play_card', payload: { cardId: 'c1' } },
  { type: 'draw' },
];

// AC-9.1: AI emits intents only; the server rejects any direct state mutation / illegal action.
describe('AI guard', () => {
  it('accepts a proposal that matches a legal action', () => {
    const res = validateProposal({ intentType: 'draw' }, legal);
    expect(res.ok).toBe(true);
    expect(res.action?.type).toBe('draw');
  });

  it('rejects an action that is not legal', () => {
    const res = validateProposal({ intentType: 'flip_table' }, legal);
    expect(res.ok).toBe(false);
    expect(res.reason).toBe('not_a_legal_action');
  });

  it('rejects payloads that try to mutate state directly', () => {
    for (const key of ['state', 'score', 'winner', 'phase', 'players']) {
      const res = validateProposal({ intentType: 'draw', payload: { [key]: 999 } }, legal);
      expect(res.ok, key).toBe(false);
      expect(res.reason).toBe('forbidden_field');
    }
  });

  it('rejects empty proposals', () => {
    expect(validateProposal({ intentType: '' }, legal).reason).toBe('empty');
  });
});

describe('hint wallet (earned/limited)', () => {
  it('is limited by budget', () => {
    let w = createHintWallet(2);
    expect(hintsRemaining(w)).toBe(2);
    w = spendHint(w).wallet;
    w = spendHint(w).wallet;
    expect(canSpendHint(w)).toBe(false);
    const denied = spendHint(w);
    expect(denied.granted).toBe(false);
  });

  it('grants only while hints remain', () => {
    const w = createHintWallet(1);
    expect(spendHint(w).granted).toBe(true);
  });

  it('can earn more hints but stays accounted', () => {
    let w = createHintWallet(0);
    expect(canSpendHint(w)).toBe(false);
    w = earnHint(w, 2);
    expect(hintsRemaining(w)).toBe(2);
  });

  it('clamps negative/fractional budgets', () => {
    expect(createHintWallet(-5).budget).toBe(0);
    expect(createHintWallet(2.9).budget).toBe(2);
  });
});
