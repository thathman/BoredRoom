#!/usr/bin/env node
// Pure-logic smoke for Color Wahala engine. No server required.
// Verifies prompt generation (Stroop guarantee + lock ramp), scoring, and round resolution shape.
import {
  DEFAULT_COLORWAHALA_SETTINGS,
  createInitialColorWahalaState,
  generatePrompt,
  resolveColorWahalaRound,
  scoreTap,
} from '../server/dist/shared/src/games/colorwahala/engine.js';

let step = 'init';
const fail = (msg) => {
  console.error(`[colorwahala-smoke] FAIL @ ${step}: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`[colorwahala-smoke] ${msg}`);

const mkPlayer = (id, displayName) => ({
  id,
  displayName,
  score: 0,
  correctCount: 0,
  bestStreak: 0,
  currentStreak: 0,
  totalLatencyMs: 0,
});

try {
  step = 'create-initial-state';
  const players = [mkPlayer('p1', 'Ada'), mkPlayer('p2', 'Bola')];
  const state = createInitialColorWahalaState(players, { ...DEFAULT_COLORWAHALA_SETTINGS });
  if (!state || state.phase !== 'lobby') fail(`unexpected phase ${state?.phase}`);
  if (state.players.length !== 2) fail('player count mismatch');

  step = 'generate-prompt-stroop-mismatch';
  const totalRounds = 15;
  for (let i = 1; i <= 50; i++) {
    const prompt = generatePrompt(((i - 1) % totalRounds) + 1, totalRounds, DEFAULT_COLORWAHALA_SETTINGS, 1234 + i);
    if (!prompt?.word || !prompt?.ink || !prompt?.answer) fail('prompt missing fields');
    if (prompt.word.id === prompt.ink.id) {
      fail(`stroop violated: word=${prompt.word.id} ink=${prompt.ink.id}`);
    }
    if (prompt.lockMs < DEFAULT_COLORWAHALA_SETTINGS.endLockMs - 1 ||
        prompt.lockMs > DEFAULT_COLORWAHALA_SETTINGS.startLockMs + 1) {
      fail(`lockMs out of ramp range: ${prompt.lockMs}`);
    }
  }

  step = 'lock-ramp-monotonic';
  const first = generatePrompt(1, totalRounds, DEFAULT_COLORWAHALA_SETTINGS, 1);
  const last = generatePrompt(totalRounds, totalRounds, DEFAULT_COLORWAHALA_SETTINGS, 2);
  if (!(first.lockMs >= last.lockMs)) fail(`expected lock to shrink: ${first.lockMs} → ${last.lockMs}`);

  step = 'score-tap';
  const fast = scoreTap(500, 5000, true, true, 250);
  const slow = scoreTap(4000, 5000, true, false, 250);
  const wrong = scoreTap(500, 5000, false, false, 250);
  if (!(fast > slow)) fail(`fast (${fast}) should exceed slow (${slow})`);
  if (wrong !== 0) fail(`wrong should score 0, got ${wrong}`);

  step = 'resolve-round';
  const prompt = generatePrompt(1, totalRounds, DEFAULT_COLORWAHALA_SETTINGS, 999);
  const taps = new Map([
    ['p1', { playerId: 'p1', pickedColor: prompt.answer, serverTs: Date.now(), latencyMs: 800, correct: true }],
    ['p2', { playerId: 'p2', pickedColor: prompt.answer, serverTs: Date.now(), latencyMs: 1500, correct: true }],
  ]);
  const { results, updatedPlayers, firstCorrectPlayerId } = resolveColorWahalaRound(
    prompt,
    players,
    taps,
    { ...DEFAULT_COLORWAHALA_SETTINGS },
  );
  if (results.length !== 2) fail(`expected 2 results, got ${results.length}`);
  if (firstCorrectPlayerId !== 'p1') fail(`expected p1 first, got ${firstCorrectPlayerId}`);
  const p1 = updatedPlayers.find((p) => p.id === 'p1');
  const p2 = updatedPlayers.find((p) => p.id === 'p2');
  if (!p1 || !p2) fail('missing updated players');
  if (p1.score <= 0) fail(`p1 should score, got ${p1.score}`);
  if (!(p1.score > p2.score)) fail(`faster correct should outscore slower (p1=${p1.score}, p2=${p2.score})`);
  if (p1.correctCount !== 1) fail(`expected p1 correctCount=1, got ${p1.correctCount}`);

  log('PASS');
} catch (err) {
  fail(err?.stack ?? String(err));
}
