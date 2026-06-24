#!/usr/bin/env node
import { Client } from 'colyseus.js';
import { randomUUID } from 'node:crypto';
import http from 'node:http';
import https from 'node:https';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';

const HTTP_URL = process.env.SMOKE_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.SMOKE_WS_URL ?? 'ws://127.0.0.1:2567';
const PROTOCOL_VERSION = 2;
const STEP_TIMEOUT_MS = 8000;
const SMOKE_MATRIX_ARTIFACT = process.env.SMOKE_MATRIX_ARTIFACT ?? 'artifacts/smoke-matrix.json';

const GAME_CASES = [
  { gameType: 'ludo', roomType: 'ludo', action: { type: 'roll_dice' } },
  { gameType: 'whot', roomType: 'whot', action: { type: 'whot:draw_card' } },
  { gameType: 'trivia', roomType: 'trivia', action: { type: 'send_reaction', emoji: '🔥' } },
  { gameType: 'connect-4', roomType: 'connect-4', action: { type: 'connect4:drop', column: 0 } },
  { gameType: 'ettt', roomType: 'ettt', action: { type: 'ettt:place', row: 0, col: 0 } },
  { gameType: 'logo', roomType: 'logo', action: { type: 'send_reaction', emoji: '🎯' } },
  { gameType: 'landlord', roomType: 'landlord', action: { type: 'landlord:roll' } },
  { gameType: 'half-half', roomType: 'half-half', action: { type: 'send_reaction', emoji: '🪙' } },
  { gameType: 'color-wahala', roomType: 'color-wahala', action: { type: 'send_reaction', emoji: '🎨' } },
  { gameType: 'hustle', roomType: 'hustle', action: { type: 'hustle:roll' } },
  { gameType: 'word-wahala', roomType: 'word-wahala', action: { type: 'wordwahala:pass' } },
];
const matrixResults = [];

let step = 'init';
const fail = (msg) => {
  writeArtifact({ ok: false, failedAt: step, error: msg, results: matrixResults });
  console.error(`[smoke-matrix] FAIL @ ${step}: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`[smoke-matrix] ${msg}`);

function waitFor(predicate, subscribe, label, timeout = STEP_TIMEOUT_MS) {
  return new Promise((resolve, reject) => {
    let done = false;
    const t = setTimeout(() => {
      if (done) return;
      done = true;
      reject(new Error(`timeout waiting for ${label}`));
    }, timeout);
    subscribe((state) => {
      if (done) return;
      if (!state) return;
      if (predicate(state)) {
        done = true;
        clearTimeout(t);
        resolve(state);
      }
    });
  });
}

function attach(room, label) {
  const listeners = new Set();
  let last = null;
  room.onMessage('event', (evt) => {
    if (evt?.type === 'public_state') {
      last = evt.state;
      listeners.forEach((fn) => fn(evt.state));
    }
    if (evt?.type === 'error') {
      console.error(`[smoke-matrix][${label}] server error: ${evt.code} ${evt.message ?? ''}`);
    }
  });
  return {
    send: (intent) => room.send('intent', intent),
    subscribe: (fn) => {
      listeners.add(fn);
      if (last) fn(last);
    },
    leave: () => room.leave(),
    getLast: () => last,
  };
}

function currentPlayerId(state) {
  if (state?.whotState?.currentPlayerId) return state.whotState.currentPlayerId;
  if (state?.triviaState?.players?.length) return state.triviaState.players[0]?.id;
  if (state?.connect4State?.currentPlayerId) return state.connect4State.currentPlayerId;
  if (state?.etttState?.currentPlayerId) return state.etttState.currentPlayerId;
  if (state?.logoState?.players?.length) return state.logoState.players[0]?.id;
  if (state?.landlordState?.currentPlayerId) return state.landlordState.currentPlayerId;
  if (state?.colorWahalaState?.players?.length) return state.colorWahalaState.players[0]?.id;
  if (state?.hustleState?.players?.length) {
    return state.hustleState.players[state.hustleState.currentPlayerIndex]?.id;
  }
  if (state?.wordWahalaState?.players?.length) {
    return state.wordWahalaState.players[state.wordWahalaState.currentPlayerIndex]?.id;
  }
  if (state?.gameState?.players?.[state.gameState.currentPlayerIndex]?.id) {
    return state.gameState.players[state.gameState.currentPlayerIndex].id;
  }
  return null;
}

async function createRoom(gameType, hostDeviceId) {
  return await requestJson(`${HTTP_URL}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostDeviceId, hostDisplayName: 'Smoke Host', gameType }),
  }, gameType);
}

function requestJson(urlString, options, gameType) {
  return new Promise((resolve, reject) => {
    const url = new URL(urlString);
    const transport = url.protocol === 'https:' ? https : http;
    const req = transport.request({
      hostname: url.hostname,
      port: url.port || (url.protocol === 'https:' ? 443 : 80),
      path: `${url.pathname}${url.search}`,
      method: options.method ?? 'GET',
      headers: options.headers ?? {},
    }, (res) => {
      let body = '';
      res.setEncoding('utf8');
      res.on('data', (chunk) => { body += chunk; });
      res.on('end', () => {
        if ((res.statusCode ?? 500) < 200 || (res.statusCode ?? 500) >= 300) {
          reject(new Error(`POST /rooms ${gameType} -> ${res.statusCode}`));
          return;
        }
        try {
          resolve(JSON.parse(body));
        } catch (err) {
          reject(new Error(`invalid JSON from /rooms: ${String(err)}`));
        }
      });
    });
    req.on('error', (err) => reject(err));
    req.setTimeout(STEP_TIMEOUT_MS, () => {
      req.destroy(new Error(`request timeout: ${urlString}`));
    });
    if (options.body) req.write(options.body);
    req.end();
  });
}

function writeArtifact(payload) {
  mkdirSync(dirname(SMOKE_MATRIX_ARTIFACT), { recursive: true });
  writeFileSync(
    SMOKE_MATRIX_ARTIFACT,
    JSON.stringify(
      {
        generatedAt: new Date().toISOString(),
        httpUrl: HTTP_URL,
        wsUrl: WS_URL,
        ...payload,
      },
      null,
      2,
    ),
    'utf8',
  );
}

async function joinRoom(client, roomType, { code, deviceId, displayName, role, hostToken, gameType }) {
  return client.joinOrCreate(roomType, {
    protocolVersion: PROTOCOL_VERSION,
    deviceId,
    displayName,
    role,
    hostToken,
    code,
    gameType,
  });
}

async function runCase(client, spec) {
  const hostDeviceId = `mx-host-${spec.gameType}-${randomUUID()}`;
  const p1Id = `mx-p1-${spec.gameType}-${randomUUID()}`;
  const p2Id = `mx-p2-${spec.gameType}-${randomUUID()}`;

  step = `${spec.gameType}:create_room`;
  const { code, hostToken } = await createRoom(spec.gameType, hostDeviceId);

  step = `${spec.gameType}:host_join`;
  const hostRoom = await joinRoom(client, spec.roomType, {
    code,
    deviceId: hostDeviceId,
    displayName: 'Host',
    role: 'host',
    hostToken,
    gameType: spec.gameType,
  });
  const host = attach(hostRoom, `${spec.gameType}-host`);

  step = `${spec.gameType}:player_join`;
  const p1Room = await joinRoom(client, spec.roomType, {
    code,
    deviceId: p1Id,
    displayName: 'Player1',
    role: 'player',
    gameType: spec.gameType,
  });
  const p1 = attach(p1Room, `${spec.gameType}-p1`);
  const p2Room = await joinRoom(client, spec.roomType, {
    code,
    deviceId: p2Id,
    displayName: 'Player2',
    role: 'player',
    gameType: spec.gameType,
  });
  const p2 = attach(p2Room, `${spec.gameType}-p2`);

  await waitFor((s) => s?.members?.some((m) => m.id === p1Id), host.subscribe, `${spec.gameType}:p1_present`);
  await waitFor((s) => s?.members?.some((m) => m.id === p2Id), host.subscribe, `${spec.gameType}:p2_present`);

  step = `${spec.gameType}:ready_start`;
  p1.send({ type: 'toggle_ready' });
  p2.send({ type: 'toggle_ready' });
  await waitFor((s) => s?.members?.find((m) => m.id === p1Id)?.isReady, host.subscribe, `${spec.gameType}:p1_ready`);
  await waitFor((s) => s?.members?.find((m) => m.id === p2Id)?.isReady, host.subscribe, `${spec.gameType}:p2_ready`);
  host.send({ type: 'host:start_game' });
  await waitFor((s) => s?.status === 'playing', host.subscribe, `${spec.gameType}:playing`, 12000);

  step = `${spec.gameType}:one_action`;
  const state = host.getLast();
  const actorId = currentPlayerId(state);
  if (actorId === p1Id) {
    p1.send(spec.action);
  } else if (actorId === p2Id) {
    p2.send(spec.action);
  } else {
    host.send(spec.action);
  }

  step = `${spec.gameType}:end_game`;
  host.send({ type: 'host:end_game', reason: 'smoke end' });
  await waitFor((s) => s?.status === 'finished', host.subscribe, `${spec.gameType}:finished`, 12000);

  step = `${spec.gameType}:reconnect`;
  p1.leave();
  await new Promise((r) => setTimeout(r, 300));
  const p1ReRoom = await joinRoom(client, spec.roomType, {
    code,
    deviceId: p1Id,
    displayName: 'Player1',
    role: 'player',
    gameType: spec.gameType,
  });
  const p1Re = attach(p1ReRoom, `${spec.gameType}-p1-re`);
  await waitFor((s) => s?.members?.some((m) => m.id === p1Id), p1Re.subscribe, `${spec.gameType}:reconnect_seen`);

  step = `${spec.gameType}:cleanup`;
  host.send({ type: 'host:play_again' });
  await waitFor((s) => s?.status === 'lobby', host.subscribe, `${spec.gameType}:back_lobby`);
  host.leave();
  p1Re.leave();
  p2.leave();
  matrixResults.push({ gameType: spec.gameType, status: 'pass' });
  log(`${spec.gameType} PASS`);
}

async function main() {
  const client = new Client(WS_URL);
  for (const spec of GAME_CASES) {
    await runCase(client, spec);
  }
  writeArtifact({ ok: true, results: matrixResults });
  log('PASS');
}

main().catch((err) => fail(err?.message ?? String(err)));
