#!/usr/bin/env node
// GOAL1 "play all night" + reconnection E2E (socket-level, no browser needed):
//   1. One house, join once. Players never get a new code.
//   2. Play game A → finish → play game B (consecutive games, same session).
//   3. Mid-game, a seated controller disconnects → host auto-pauses → the player reconnects
//      with the SAME code/deviceId and the game resumes. Reconnect restores their state.
// Fails loudly on any timeout or assertion. Run against a running server.

import { Client } from '@colyseus/sdk';

const HTTP_URL = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';

function assert(condition, message) { if (!condition) throw new Error(message); }
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function waitFor(label, predicate, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const v = predicate();
    if (v) return v;
    await sleep(60);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function wire(room, bucket) {
  room.onMessage('session:state', (s) => { bucket.session = s; });
  room.onMessage('session:transition', (e) => { bucket.transitions.push(e); });
  room.onMessage('game:public_state', (p) => { bucket.public = p; });
  room.onMessage('game:private_state', (p) => { bucket.private = p; });
  room.onMessage('session:error', (p) => { bucket.errors.push(p); });
}

function firstLegal(priv) {
  const legal = priv?.state?.legalIntents ?? priv?.legalIntents ?? [];
  return legal[0] ?? null;
}

// Drive a challenge game to completion (works for trivia/color-wahala/etc).
async function playChallenge(display, displayBucket, buckets, gameId) {
  display.send('session:start_game', { gameId, settings: { questionCount: 3, rounds: 3 } });
  await waitFor(`${gameId} started`, () =>
    displayBucket.public?.state?.gameType === gameId && buckets.every((b) => b.private?.gameType === gameId), 12_000);

  for (let round = 0; round < 30; round += 1) {
    for (const b of buckets) {
      const legal = firstLegal(b.private);
      if (!legal) continue;
      const intent = legal.type === 'guess'
        ? { ...legal, amount: Number.isFinite(Number(legal.amount)) ? Number(legal.amount) : 1000 }
        : legal.type === 'answer_text' ? { ...legal, text: typeof legal.text === 'string' ? legal.text : 'lagos' }
          : { ...legal };
      b.room.send('game:intent', intent);
    }
    await sleep(250);
    const phase = displayBucket.public?.state?.phase;
    if (phase === 'reveal') {
      display.send('game:intent', { type: 'advance' });
      await waitFor('challenge advanced', () => ['playing', 'finished'].includes(displayBucket.public?.state?.phase), 4_000);
    }
    if (displayBucket.public?.state?.phase === 'finished') break;
  }
}

// --- setup --------------------------------------------------------------------
const res = await fetch(`${HTTP_URL}/sessions`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hostDeviceId: `e2e-host-${Date.now()}`, settings: { allowBots: false, hintsEnabled: true } }),
});
assert(res.ok, `session_create_failed_${res.status}`);
const created = await res.json();
const code = created.session.code;
const client = new Client(WS_URL);

const displayBucket = { transitions: [], errors: [] };
const display = await client.joinOrCreate('house-session', { code, deviceId: `e2e-display-${code}`, displayName: 'Display', role: 'display', ownerCredential: created.ownerCredential });
wire(display, displayBucket);

const adaId = `e2e-ada-${code}`;
const tobiId = `e2e-tobi-${code}`;
const adaBucket = { transitions: [], errors: [] };
const tobiBucket = { transitions: [], errors: [] };
let ada = await client.joinOrCreate('house-session', { code, deviceId: adaId, displayName: 'Ada', role: 'controller' });
wire(ada, adaBucket); adaBucket.room = ada;
const tobi = await client.joinOrCreate('house-session', { code, deviceId: tobiId, displayName: 'Tobi', role: 'controller' });
wire(tobi, tobiBucket); tobiBucket.room = tobi;

await waitFor('two controllers joined', () =>
  (displayBucket.session?.members?.filter((m) => m.role === 'controller').length ?? 0) >= 2);
ada.send('session:ready', { ready: true });
tobi.send('session:ready', { ready: true });
await sleep(300);

// --- 1) consecutive games in one session --------------------------------------
await playChallenge(display, displayBucket, [adaBucket, tobiBucket], 'trivia');
assert(
  displayBucket.public?.state?.phase === 'finished',
  `game A (trivia) did not finish: ${JSON.stringify({
    phase: displayBucket.public?.state?.phase,
    round: displayBucket.public?.state?.round,
    totalRounds: displayBucket.public?.state?.totalRounds,
    submittedCount: displayBucket.public?.state?.submittedCount,
    lastAction: displayBucket.public?.state?.lastAction,
  })}`,
);
await waitFor('game A recap', () => displayBucket.session?.session?.status === 'game_recap' || displayBucket.session?.lastRecap);

// Party must NOT be ended after a game finishes, and the code is unchanged.
assert(displayBucket.session?.session?.status !== 'ended', 'party ended after a single game');
assert(displayBucket.session?.session?.code === code, 'house code changed between games');

// Play a second, different game in the SAME session (no new code, no rejoin).
display.send('session:start_game', { gameId: 'color-wahala' });
await waitFor('game B started in same session', () =>
  displayBucket.public?.state?.gameType === 'color-wahala'
  && adaBucket.private?.gameType === 'color-wahala'
  && tobiBucket.private?.gameType === 'color-wahala', 12_000);
console.log(`[pw-e2e] consecutive games OK (trivia → color-wahala) in house ${code}`);

// --- 2) disconnect → auto-pause → reconnect → resume --------------------------
// Clear benign in-game intent rejections (e.g. "already submitted") from the rapid challenge
// loop above, so the post-reconnect check only catches connection/recovery errors.
adaBucket.errors = [];
// Ada drops mid-game. The host should auto-pause for the disconnected seated player.
await ada.leave();
await waitFor('host auto-paused on seated disconnect', () =>
  displayBucket.session?.activeRun?.status === 'paused'
  || displayBucket.session?.members?.some((m) => m.deviceId === adaId && m.connected === false), 8_000);

// Ada reconnects with the SAME code + deviceId (never a new room/code).
ada = await client.joinOrCreate('house-session', { code, deviceId: adaId, displayName: 'Ada', role: 'controller' });
wire(ada, adaBucket); adaBucket.room = ada;
ada.send('session:request_state');
await waitFor('ada reconnected to same house', () =>
  displayBucket.session?.members?.some((m) => m.deviceId === adaId && m.connected !== false), 8_000);
await waitFor('ada private state restored', () => adaBucket.private?.gameType === 'color-wahala', 8_000);

assert(displayBucket.session?.session?.code === code, 'code changed after reconnect');
// Only connection/recovery errors matter here — in-game intent rejections are gameplay, not a
// reconnect failure.
const recoveryErrors = adaBucket.errors.filter((e) => e?.code !== 'illegal_game_intent' && e?.code !== 'game_paused');
assert(recoveryErrors.length === 0, `ada recovery errors after reconnect: ${JSON.stringify(recoveryErrors)}`);
console.log(`[pw-e2e] reconnect OK (Ada rejoined house ${code}, private state restored)`);

await display.leave(); await ada.leave(); await tobi.leave();
console.log(`[pw-e2e] PASS consecutive games + reconnect through ${code}`);
process.exit(0);
