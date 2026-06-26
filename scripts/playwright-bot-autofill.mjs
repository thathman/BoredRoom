#!/usr/bin/env node
import { Client } from '@colyseus/sdk';

const HTTP_URL = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, predicate, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = predicate();
    if (value) return value;
    await sleep(75);
  }
  throw new Error(`timeout waiting for ${label}`);
}

function wireRoom(room, bucket) {
  room.onMessage('session:state', (state) => { bucket.session = state; });
  room.onMessage('game:public_state', (payload) => { bucket.public = payload; });
  room.onMessage('game:private_state', (payload) => { bucket.private = payload; });
  room.onMessage('session:error', (payload) => { bucket.errors.push(payload); });
}

const createdResponse = await fetch(`${HTTP_URL}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    hostDeviceId: `bot-host-${Date.now()}`,
    settings: { allowBots: true, allowCrowdVotes: true, hintsEnabled: true, maxControllers: 8 },
  }),
});
assert(createdResponse.ok, `session_create_failed_${createdResponse.status}`);
const created = await createdResponse.json();
const code = created.session.code;

const client = new Client(WS_URL);
const displayBucket = { errors: [] };
const controllerBucket = { errors: [] };

const display = await client.joinOrCreate('house-session', {
  code,
  deviceId: `bot-display-${code}`,
  displayName: 'Bot smoke display',
  role: 'display',
  ownerCredential: created.ownerCredential,
});
wireRoom(display, displayBucket);

const controller = await client.joinOrCreate('house-session', {
  code,
  deviceId: `bot-human-${code}`,
  displayName: 'Human Ada',
  role: 'controller',
});
wireRoom(controller, controllerBucket);

await waitFor('controller private ready', () => controllerBucket.session?.members?.some((member) => member.deviceId === `bot-human-${code}`));
display.send('session:start_game', { gameId: 'whot' });

const botMember = await waitFor('bot member', () =>
  displayBucket.session?.members?.find((member) => member.isBot && member.role === 'controller'),
);
await waitFor('whot public state with bot seat', () => {
  const state = displayBucket.public?.state;
  return displayBucket.public?.gameType === 'whot'
    && state?.players?.some?.((player) => player.id === botMember.deviceId)
    && state?.players?.some?.((player) => player.id === `bot-human-${code}`)
    ? state
    : null;
});

assert(displayBucket.errors.length === 0, `display_errors_${JSON.stringify(displayBucket.errors)}`);
assert(controllerBucket.errors.length === 0, `controller_errors_${JSON.stringify(controllerBucket.errors)}`);
console.log(`[pw-bots] PASS bot ${botMember.displayName} seated in ${code}`);

await controller.leave();
await display.leave();
