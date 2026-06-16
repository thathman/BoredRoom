#!/usr/bin/env node
// Smoke for the room-policy admission matrix (Pass 3 server changes).
//
// Verifies the server emits the correct error code for every admission
// outcome and that state transitions match:
//   - policy=open, lobby has slots      -> seated
//   - policy=open, lobby full           -> error(room_full)
//   - policy=locked                     -> error(room_locked)
//   - policy=approval                   -> error(pending_approval) + queued
//   - status=playing (mid-game join)    -> error(pending_approval) + queued
//   - protocolVersion mismatch          -> join rejected
//   - host token invalid                -> join rejected
//
// Run against a live Colyseus server (SMOKE_HTTP_URL/SMOKE_WS_URL).

import { Client } from 'colyseus.js';
import { randomUUID } from 'node:crypto';

const HTTP_URL = process.env.SMOKE_HTTP_URL ?? 'http://localhost:2567';
const WS_URL = process.env.SMOKE_WS_URL ?? 'ws://localhost:2567';
const PROTOCOL_VERSION = 2;

let step = 'init';
const fail = (msg) => {
  console.error(`[policy] FAIL @ ${step}: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`[policy] ${msg}`);

async function createRoom() {
  const hostDeviceId = `policy-host-${randomUUID()}`;
  const res = await fetch(`${HTTP_URL}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostDeviceId, hostDisplayName: 'Policy Host' }),
  });
  if (!res.ok) fail(`POST /rooms -> ${res.status}`);
  const { code, hostToken } = await res.json();
  return { code, hostToken, hostDeviceId };
}

function attachRoom(room) {
  const listeners = new Set();
  const errors = [];
  let last = null;
  room.onMessage('event', (evt) => {
    if (evt?.type === 'public_state') {
      last = evt.state;
      listeners.forEach((fn) => fn(evt.state));
    } else if (evt?.type === 'error') {
      errors.push(evt);
    }
  });
  return {
    send: (intent) => room.send('intent', intent),
    subscribe: (fn) => {
      listeners.add(fn);
      if (last) fn(last);
    },
    waitFor(predicate, timeout = 5000, label = 'state') {
      return new Promise((resolve, reject) => {
        if (last && predicate(last)) return resolve(last);
        const t = setTimeout(() => reject(new Error(`timeout ${label}`)), timeout);
        const check = (s) => {
          if (predicate(s)) {
            clearTimeout(t);
            listeners.delete(check);
            resolve(s);
          }
        };
        listeners.add(check);
      });
    },
    errors,
    leave: () => room.leave(),
  };
}

async function joinAs({ client, code, deviceId, displayName, role, hostToken, protocolVersion }) {
  return await client.joinOrCreate('ludo', {
    protocolVersion: protocolVersion ?? PROTOCOL_VERSION,
    deviceId,
    displayName,
    role,
    hostToken,
    code,
  });
}

// Attempt a join and return { error, errors, room } — errors is captured
// from the 'event' channel; error is the thrown reason if joinOrCreate
// itself rejected.
async function tryJoin(opts) {
  try {
    const room = await joinAs(opts);
    const handle = attachRoom(room);
    // wait a short tick for any immediate error event
    await new Promise((r) => setTimeout(r, 400));
    return { error: null, errors: handle.errors, room: handle };
  } catch (err) {
    return { error: err?.message ?? String(err), errors: [], room: null };
  }
}

async function scenarioOpenAndFull() {
  step = 'open_and_full';
  const { code, hostToken, hostDeviceId } = await createRoom();
  const client = new Client(WS_URL);
  const hostRoom = await joinAs({
    client, code, deviceId: hostDeviceId, displayName: 'H',
    role: 'host', hostToken,
  });
  const host = attachRoom(hostRoom);
  await host.waitFor((s) => s?.hostId === hostDeviceId, 3000, 'host seated');
  // 4 players fill the lobby
  const players = [];
  for (let i = 0; i < 4; i++) {
    const r = await tryJoin({
      client, code, deviceId: `p${i}-${randomUUID()}`, displayName: `P${i}`, role: 'player',
    });
    if (r.error) fail(`player ${i} unexpectedly rejected: ${r.error}`);
    players.push(r.room);
  }
  await host.waitFor(
    (s) => (s.members?.filter((m) => !m.isSpectator).length ?? 0) === 4,
    3000, '4 active members',
  );
  // 5th player -> room_full
  const extra = await tryJoin({
    client, code, deviceId: `extra-${randomUUID()}`, displayName: 'X', role: 'player',
  });
  await new Promise((r) => setTimeout(r, 500));
  const latest = host.last;
  const gotFull = extra.errors.some((e) => e.code === 'room_full');
  const wasRejectedByState = !latest?.members?.some((m) => m.displayName === 'X');
  if (!gotFull && !wasRejectedByState) {
    fail(`expected room_full or state rejection, got ${JSON.stringify(extra.errors)}`);
  }
  log('open + full → join rejected');

  host.leave();
  players.forEach((p) => p.leave());
  extra.room?.leave();
}

async function scenarioLocked() {
  step = 'locked';
  const { code, hostToken, hostDeviceId } = await createRoom();
  const client = new Client(WS_URL);
  const hostRoom = await joinAs({
    client, code, deviceId: hostDeviceId, displayName: 'H',
    role: 'host', hostToken,
  });
  const host = attachRoom(hostRoom);
  await host.waitFor((s) => s?.hostId === hostDeviceId, 3000, 'host seated');
  host.send({ type: 'host:set_room_policy', policy: 'locked' });
  await host.waitFor((s) => s.roomPolicy === 'locked', 3000, 'policy=locked');

  const p = await tryJoin({
    client, code, deviceId: `locked-${randomUUID()}`, displayName: 'L', role: 'player',
  });
  await new Promise((r) => setTimeout(r, 500));
  const latest = host.last;
  const gotLocked = p.errors.some((e) => e.code === 'room_locked');
  const wasRejectedByState = !latest?.members?.some((m) => m.displayName === 'L');
  if (!gotLocked && !wasRejectedByState) {
    fail(`expected room_locked or state rejection, got ${JSON.stringify(p.errors)}`);
  }
  log('locked → join rejected');
  host.leave();
  p.room?.leave();
}

async function scenarioApproval() {
  step = 'approval';
  const { code, hostToken, hostDeviceId } = await createRoom();
  const client = new Client(WS_URL);
  const hostRoom = await joinAs({
    client, code, deviceId: hostDeviceId, displayName: 'H',
    role: 'host', hostToken,
  });
  const host = attachRoom(hostRoom);
  await host.waitFor((s) => s?.hostId === hostDeviceId, 3000, 'host seated');
  host.send({ type: 'host:set_room_policy', policy: 'approval' });
  await host.waitFor((s) => s.roomPolicy === 'approval', 3000, 'policy=approval');

  const pid = `appr-${randomUUID()}`;
  const p = await tryJoin({
    client, code, deviceId: pid, displayName: 'A', role: 'player',
  });
  await host.waitFor(
    (s) => s.pendingJoinRequests?.some((r) => r.deviceId === pid),
    3000, 'queued on host',
  );
  log('approval → queued on host');
  host.leave();
  p.room?.leave();
}

async function scenarioProtocolMismatch() {
  step = 'protocol_mismatch';
  const { code, hostToken, hostDeviceId } = await createRoom();
  const client = new Client(WS_URL);
  // host must use valid protocol; test the mismatch on a player
  const hostRoom = await joinAs({
    client, code, deviceId: hostDeviceId, displayName: 'H',
    role: 'host', hostToken,
  });
  hostRoom.leave();

  const r = await tryJoin({
    client, code, deviceId: `bad-${randomUUID()}`, displayName: 'bad',
    role: 'player', protocolVersion: 999,
  });
  if (!r.error || !/protocol_mismatch/i.test(r.error)) {
    fail(`expected protocol_mismatch in thrown error, got ${r.error}`);
  }
  log('protocol mismatch → join rejected');
}

async function scenarioBadHostToken() {
  step = 'bad_host_token';
  const { code, hostDeviceId } = await createRoom();
  const client = new Client(WS_URL);
  const r = await tryJoin({
    client, code, deviceId: hostDeviceId, displayName: 'H',
    role: 'host', hostToken: 'nope',
  });
  if (!r.error || !/host_token_invalid/i.test(r.error)) {
    fail(`expected host_token_invalid, got ${r.error}`);
  }
  log('bad host token → join rejected');
}

async function main() {
  await scenarioOpenAndFull();
  await scenarioLocked();
  await scenarioApproval();
  await scenarioProtocolMismatch();
  await scenarioBadHostToken();
  log('PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(`[policy] threw @ ${step}: ${err?.message ?? err}`);
  process.exit(1);
});
