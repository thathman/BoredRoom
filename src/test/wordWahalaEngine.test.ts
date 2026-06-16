import { describe, it, expect } from 'vitest';
import {
  CENTER,
} from '../../shared/src/games/wordwahala/board';
import {
  DEFAULT_WORDWAHALA_SETTINGS,
  createInitialWordWahalaState,
  validateAndScore,
  applyPlay,
  applyPass,
  makeInitialPlayer,
  type WordWahalaPublicState,
} from '../../shared/src/games/wordwahala/engine';
import { buildTileBag, tileBagSize } from '../../shared/src/games/wordwahala/tiles';
import { lookupWord } from '../../shared/src/games/wordwahala/dictionary';

function startGame(): WordWahalaPublicState {
  const players = [makeInitialPlayer('p1', 'Ada'), makeInitialPlayer('p2', 'Tunde')];
  const state = createInitialWordWahalaState(players, { ...DEFAULT_WORDWAHALA_SETTINGS });
  return { ...state, phase: 'playing' };
}

type ValidateResult = ReturnType<typeof validateAndScore>;
type RejectResult = Extract<ValidateResult, { ok: false }>;

function expectReject(res: ValidateResult, contains: string): void {
  if (res.ok) throw new Error(`expected rejection but play accepted`);
  expect((res as RejectResult).rejection).toContain(contains);
}

describe('Word Wahala — tiles', () => {
  it('builds a bag with stable size', () => {
    const bag = buildTileBag();
    expect(bag.length).toBe(tileBagSize());
    expect(bag.length).toBeGreaterThan(80);
    expect(bag.length).toBeLessThan(140);
  });
});

describe('Word Wahala — dictionary tiers', () => {
  it('looks up standard words', () => {
    expect(lookupWord('cat').tier).toBe('standard');
    expect(lookupWord('quick').tier).toBe('standard');
  });
  it('looks up pidgin words at higher priority than standard', () => {
    expect(lookupWord('wahala').tier).toBe('pidgin');
    expect(lookupWord('sabi').tier).toBe('pidgin');
  });
  it('looks up indigenous words', () => {
    expect(lookupWord('jollof').tier).toBe('indigenous');
    expect(lookupWord('suya').tier).toBe('indigenous');
  });
  it('rejects unknown words', () => {
    expect(lookupWord('zzqxk').found).toBe(false);
  });
});

describe('Word Wahala — engine', () => {
  it('first play must cover the center star', () => {
    const state = startGame();
    const bad = validateAndScore(state, 'p1', [
      { row: 0, col: 0, letter: 'c' },
      { row: 0, col: 1, letter: 'a' },
      { row: 0, col: 2, letter: 't' },
    ]);
    expectReject(bad, 'center');
  });

  it('scores a simple first play through center', () => {
    const state = startGame();
    const res = validateAndScore(state, 'p1', [
      { row: CENTER, col: CENTER, letter: 'c' },
      { row: CENTER, col: CENTER + 1, letter: 'a' },
      { row: CENTER, col: CENTER + 2, letter: 't' },
    ]);
    if (!res.ok) throw new Error('expected play accepted');
    expect(res.result.words[0].word).toBe('cat');
    expect(res.result.totalScore).toBe(10);
  });

  it('rejects placement that does not connect after first play', () => {
    let state = startGame();
    const r1 = validateAndScore(state, 'p1', [
      { row: CENTER, col: CENTER, letter: 'c' },
      { row: CENTER, col: CENTER + 1, letter: 'a' },
      { row: CENTER, col: CENTER + 2, letter: 't' },
    ]);
    if (!r1.ok) throw new Error('first play should accept');
    state = applyPlay(state, 'p1', r1.result);

    const r2 = validateAndScore(state, 'p2', [
      { row: 0, col: 0, letter: 'd' },
      { row: 0, col: 1, letter: 'o' },
      { row: 0, col: 2, letter: 'g' },
    ]);
    expectReject(r2, 'connect');
  });

  it('applies pidgin tier multiplier + flat bonus', () => {
    const state = startGame();
    const res = validateAndScore(state, 'p1', [
      { row: CENTER, col: CENTER, letter: 'w' },
      { row: CENTER, col: CENTER + 1, letter: 'a' },
      { row: CENTER, col: CENTER + 2, letter: 'h' },
      { row: CENTER, col: CENTER + 3, letter: 'a' },
      { row: CENTER, col: CENTER + 4, letter: 'l' },
      { row: CENTER, col: CENTER + 5, letter: 'a' },
    ]);
    if (!res.ok) throw new Error('expected accept');
    const w = res.result.words[0];
    expect(w.tier).toBe('pidgin');
    // WAHALA: w4+a1+h4+a1+l(1×DL@col11=2)+a1 = 13 base × center DW (2) × pidgin
    // mult 1.5 = round(39) = 39 → +5 flat = 44.
    expect(w.finalScore).toBe(44);
  });

  it('rejects gaps between placed tiles', () => {
    const state = startGame();
    const res = validateAndScore(state, 'p1', [
      { row: CENTER, col: CENTER, letter: 'c' },
      { row: CENTER, col: CENTER + 2, letter: 't' },
    ]);
    expectReject(res, 'gap');
  });

  it('rejects unknown words', () => {
    const state = startGame();
    const res = validateAndScore(state, 'p1', [
      { row: CENTER, col: CENTER, letter: 'z' },
      { row: CENTER, col: CENTER + 1, letter: 'q' },
      { row: CENTER, col: CENTER + 2, letter: 'x' },
    ]);
    expectReject(res, 'not_a_word');
  });

  it('finishes after maxConsecutivePasses', () => {
    let state = startGame();
    state = { ...state, settings: { ...state.settings, maxConsecutivePasses: 2 } };
    state = applyPass(state, 'p1');
    state = applyPass(state, 'p2');
    expect(state.phase).toBe('finished');
  });
});
