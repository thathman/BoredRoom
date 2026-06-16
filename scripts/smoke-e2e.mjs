#!/usr/bin/env node
// End-to-end smoke against a running BoredRoom server.
//
// Flow: create room -> host joins -> 2 players join -> autofill bots to 4 ->
//       start game -> assert status=playing -> a player drops+reconnects ->
//       assert seat preserved. play_again is not tested here because it
//       requires status=finished which needs a full game replay — that is
//       covered by the server vitest suite.
//
// Env:
//   SMOKE_HTTP_URL (default http://localhost:2567)
//   SMOKE_WS_URL   (default ws://localhost:2567)
//
// Exits non-zero on any deviation. Designed for CI + local Docker stack.

import { Client } from 'colyseus.js';
import { randomUUID } from 'node:crypto';

const HTTP_URL = process.env.SMOKE_HTTP_URL ?? 'http://localhost:2567';
const WS_URL = process.env.SMOKE_WS_URL ?? 'ws://localhost:2567';
const PROTOCOL_VERSION = 2;
const STEP_TIMEOUT_MS = 5000;

let step = 'init';
const fail = (msg) => {
  console.error(`[smoke] FAIL @ ${step}: ${msg}`);
  process.exit(1);
};

const log = (msg) => console.log(`[smoke] ${msg}`);

function waitFor(predicate, { onState, timeout = STEP_TIMEOUT_MS, label } = {}) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`timeout waiting for ${label ?? 'condition'}`));
    }, timeout);
    const check = (state) => {
      if (done) return;
      if (predicate(state)) {
        done = true;
        clearTimeout(t);
        resolve(state);
      }
    };
    onState(check);
  });
}

function attachRoom(room, label) {
  const listeners = new Set();
  let last = null;
  room.onMessage('event', (evt) => {
    if (evt?.type === 'public_state') {
      last = evt.state;
      listeners.forEach((fn) => fn(evt.state));
    }
    if (evt?.type === 'error') {
      console.error(`[smoke][${label}] server error: ${evt.code} ${evt.message ?? ''}`);
    }
  });
  return {
    send: (intent) => room.send('intent', intent),
    subscribe: (fn) => {
      listeners.add(fn);
      if (last) fn(last);
    },
    leave: () => room.leave(),
  };
}

async function joinRoom({ client, code, deviceId, displayName, role, hostToken }) {
  return await client.joinOrCreate('ludo', {
    protocolVersion: PROTOCOL_VERSION,
    deviceId,
    displayName,
    role,
    hostToken,
    code,
  });
}

async function main() {
  step = 'create_room';
  const hostDeviceId = `smoke-host-${randomUUID()}`;
  const createRes = await fetch(`${HTTP_URL}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostDeviceId, hostDisplayName: 'Smoke Host' }),
  });
  if (!createRes.ok) fail(`POST /rooms -> ${createRes.status}`);
  const { code, hostToken } = await createRes.json();
  log(`room ${code} created`);

  const client = new Client(WS_URL);
  let lastState = null;
  const onState = (fn) => (state) => {
    lastState = state;
    fn(state);
  };

  step = 'host_join';
  const hostRoom = await joinRoom({
    client,
    code,
    deviceId: hostDeviceId,
    displayName: 'Smoke Host',
    role: 'host',
    hostToken,
  });
  const host = attachRoom(hostRoom, 'host');
  const hostStates = [];
  host.subscribe((s) => {
    lastState = s;
    hostStates.push(s);
  });
  await waitFor(() => lastState?.hostId === hostDeviceId, {
    onState: host.subscribe,
    label: 'host_seated',
  });
  log(`host seated`);

  step = 'player_join';
  const p1Id = `smoke-p1-${randomUUID()}`;
  const p1Room = await joinRoom({
    client,
    code,
    deviceId: p1Id,
    displayName: 'Alice',
    role: 'player',
  });
  const p1 = attachRoom(p1Room, 'p1');
  await waitFor((s) => s?.members?.some((m) => m.id === p1Id), {
    onState: host.subscribe,
    label: 'p1 in members',
  });
  log('p1 seated');

  step = 'autofill_bots';
  host.send({ type: 'host:autofill_bots', targetCount: 4, difficulty: 'smart' });
  await waitFor(
    (s) => (s?.members?.filter((m) => !m.isSpectator).length ?? 0) >= 4,
    { onState: host.subscribe, label: 'lobby full (4 active)' },
  );
  log('lobby filled to 4');

  step = 'toggle_ready_p1';
  p1.send({ type: 'toggle_ready' });
  await waitFor(
    (s) => s?.members?.find((m) => m.id === p1Id)?.isReady === true,
    { onState: host.subscribe, label: 'p1 ready' },
  );

  step = 'start_game';
  host.send({ type: 'host:start_game' });
  await waitFor((s) => s?.status === 'playing', {
    onState: host.subscribe,
    label: 'status=playing',
    timeout: 8000,
  });
  log('game started');

  step = 'reconnect_p1';
  p1.leave();
  await new Promise((r) => setTimeout(r, 500));
  const p1RoomAgain = await joinRoom({
    client,
    code,
    deviceId: p1Id,
    displayName: 'Alice',
    role: 'player',
  });
  const p1Again = attachRoom(p1RoomAgain, 'p1-reconnect');
  let reconnectedOk = false;
  p1Again.subscribe((s) => {
    const m = s?.members?.find((mm) => mm.id === p1Id);
    if (m && !m.isSpectator) reconnectedOk = true;
  });
  await waitFor(() => reconnectedOk, {
    onState: (fn) => p1Again.subscribe(fn),
    label: 'p1 seat preserved on reconnect',
  });
  log('p1 reconnect preserved seat');

  host.leave();
  p1Again.leave();
  log('PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(`[smoke] threw @ ${step}: ${err?.message ?? err}`);
  process.exit(1);
});
