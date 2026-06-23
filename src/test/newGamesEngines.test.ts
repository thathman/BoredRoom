import { describe, expect, it } from 'vitest';
import {
  createInitialPidginState,
  startRound as pidginStart,
  submitAnswer,
  resolveRound as pidginResolve,
  type PidginPrompt,
} from '../../shared/src/games/pidgintranslator/engine';
import {
  createInitialFaithFeudState,
  startRound as feudStart,
  submitGuess as feudGuess,
  endRound as feudEnd,
  roundOver,
  matchAnswer,
  type FeudQuestion,
} from '../../shared/src/games/faithfeud/engine';
import {
  createInitialBibleTimelineState,
  startRound as tlStart,
  submitOrder,
  scoreOrder,
  resolveRound as tlResolve,
  type TimelineEvent,
} from '../../shared/src/games/bibletimeline/engine';
import { getAdapter, hasAdapter } from '@/lib/adapters';

// AC-8.1: each new game plays end-to-end behind the adapter contract (engine correctness here).

describe('pidgin translator engine', () => {
  const prompt: PidginPrompt = {
    id: 'p1', source: 'How are you?', direction: 'en_to_pcm',
    options: ['How you dey?', 'Wetin be dat?', 'I dey come'], answerIndex: 0,
  };
  it('scores correct answers with a first-correct bonus', () => {
    let s = createInitialPidginState([{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], { rounds: 1, basePoints: 100, firstBonus: 50 });
    s = pidginStart(s, prompt);
    s = submitAnswer(s, 'a', 0); // correct, first
    s = submitAnswer(s, 'b', 0); // correct, second
    s = pidginResolve(s);
    expect(s.phase).toBe('finished');
    expect(s.lastDeltas.a).toBe(150);
    expect(s.lastDeltas.b).toBe(100);
  });
  it('locks after first answer and rejects bad indices', () => {
    let s = pidginStart(createInitialPidginState([{ id: 'a', name: 'A' }]), prompt);
    s = submitAnswer(s, 'a', 1); // wrong, locked
    s = submitAnswer(s, 'a', 0); // ignored (locked)
    s = submitAnswer(s, 'ghost', 0);
    expect(s.answers).toEqual({ a: 1 });
  });
});

describe('faith feud engine', () => {
  const q: FeudQuestion = {
    id: 'q1', prompt: 'Name a fruit of the Spirit',
    answers: [
      { text: 'Love', points: 40 },
      { text: 'Joy', points: 30, aliases: ['happiness'] },
      { text: 'Peace', points: 20 },
    ],
  };
  it('reveals + banks points on match, strikes on miss', () => {
    let s = feudStart(createInitialFaithFeudState([{ id: 't1', name: 'Reds' }], { rounds: 1, maxStrikes: 3 }), q);
    s = feudGuess(s, 'love');        // +40
    s = feudGuess(s, 'happiness');   // alias of Joy +30
    s = feudGuess(s, 'banana');      // strike
    expect(s.roundPot).toBe(70);
    expect(s.strikes).toBe(1);
    s = feudEnd(s, 't1');
    expect(s.teams[0].score).toBe(70);
  });
  it('round ends on three strikes', () => {
    let s = feudStart(createInitialFaithFeudState([{ id: 't1', name: 'Reds' }], { rounds: 1, maxStrikes: 3 }), q);
    s = feudGuess(s, 'x'); s = feudGuess(s, 'y'); s = feudGuess(s, 'z');
    expect(roundOver(s)).toBe(true);
  });
  it('matchAnswer skips already-revealed answers', () => {
    expect(matchAnswer(q, 'love', [0])).toBe(-1);
    expect(matchAnswer(q, 'peace', [0])).toBe(2);
  });
});

describe('bible timeline engine', () => {
  const deal: TimelineEvent[] = [
    { id: 'exodus', label: 'The Exodus', order: -1446 },
    { id: 'creation', label: 'Creation', order: -4000 },
    { id: 'cross', label: 'The Crucifixion', order: 30 },
  ];
  it('scores correctly-ordered pairs and a perfect bonus', () => {
    const perfect = ['creation', 'exodus', 'cross'];
    expect(scoreOrder(perfect, deal, { rounds: 1, pointsPerPair: 100, perfectBonus: 200 })).toBe(2 * 100 + 200);
    const oneRight = ['creation', 'cross', 'exodus']; // creation<=cross ok, cross<=exodus no
    expect(scoreOrder(oneRight, deal, { rounds: 1, pointsPerPair: 100, perfectBonus: 200 })).toBe(100);
  });
  it('only accepts a permutation of the deal', () => {
    let s = tlStart(createInitialBibleTimelineState([{ id: 'a', name: 'A' }], { rounds: 1, pointsPerPair: 100, perfectBonus: 200 }), deal);
    s = submitOrder(s, 'a', ['creation', 'exodus']); // wrong length
    expect(s.submissions.a).toBeUndefined();
    s = submitOrder(s, 'a', ['creation', 'exodus', 'cross']);
    expect(s.submissions.a).toEqual(['creation', 'exodus', 'cross']);
    s = tlResolve(s);
    expect(s.phase).toBe('finished');
    expect(s.lastDeltas.a).toBe(400);
  });
});

describe('Phase 8 adapters registered', () => {
  it('all four new games have adapters with rules', () => {
    for (const slug of ['market-price', 'pidgin-translator', 'faith-feud', 'bible-timeline']) {
      expect(hasAdapter(slug), slug).toBe(true);
      expect(getAdapter(slug)!.explainRules().length).toBeGreaterThan(0);
    }
  });
});
