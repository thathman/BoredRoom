#!/usr/bin/env node
import { Client } from 'colyseus.js';
import { randomUUID } from 'node:crypto';

const HTTP_URL = process.env.SMOKE_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.SMOKE_WS_URL ?? 'ws://127.0.0.1:2567';
const PROTOCOL_VERSION = 2;
let step = 'init';

const fail = (msg) => {
  console.error(`[whot-smoke] FAIL @ ${step}: ${msg}`);
  process.exit(1);
};
const log = (msg) => console.log(`[whot-smoke] ${msg}`);

function attach(room) {
  const listeners = new Set();
  const privateListeners = new Set();
  const eventListeners = new Set();
  let last = null;
  let privateState = null;
  let privateSeq = 0;
  const events = [];
  room.onMessage('event', (evt) => {
    events.push(evt);
    eventListeners.forEach((fn) => fn(evt));
    if (evt?.type === 'public_state') {
      last = evt.state;
      listeners.forEach((fn) => fn(evt.state));
    }
    if (evt?.type === 'private_state') {
      privateState = evt.state;
      privateSeq += 1;
      privateListeners.forEach((fn) => fn(evt.state, privateSeq));
    }
  });
  return {
    send: (intent) => room.send('intent', intent),
    get last() { return last; },
    get privateState() { return privateState; },
    get privateSeq() { return privateSeq; },
    get events() { return events; },
    waitFor(predicate, timeout = 6000, label = 'state') {
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
    waitForPrivate(predicate, timeout = 3000, label = 'private state') {
      return new Promise((resolve, reject) => {
        if (privateState && predicate(privateState, privateSeq)) return resolve(privateState);
        const t = setTimeout(() => reject(new Error(`timeout ${label}`)), timeout);
        const check = (s, seq) => {
          if (predicate(s, seq)) {
            clearTimeout(t);
            privateListeners.delete(check);
            resolve(s);
          }
        };
        privateListeners.add(check);
      });
    },
    waitForEvent(predicate, timeout = 5000, label = 'event') {
      return new Promise((resolve, reject) => {
        const existing = events.find((evt) => predicate(evt));
        if (existing) return resolve(existing);
        const t = setTimeout(() => {
          eventListeners.delete(check);
          reject(new Error(`timeout ${label}`));
        }, timeout);
        const check = (evt) => {
          if (predicate(evt)) {
            clearTimeout(t);
            eventListeners.delete(check);
            resolve(evt);
          }
        };
        eventListeners.add(check);
      });
    },
    leave: () => room.leave(),
  };
}

function bestShape(hand) {
  const counts = new Map();
  for (const card of hand) {
    if (card.isWhot || card.shape === 'whot') continue;
    counts.set(card.shape, (counts.get(card.shape) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'circle';
}

function cardScore(card, activeShape) {
  // Smoke wants a deterministic finish, not an aggressive strategy. Avoid
  // table-inflating cards unless they are the only legal progress.
  const specialPenalty = card.value === 14 ? 80 : card.value === 2 || card.value === 5 ? 40 : 0;
  const whotPenalty = card.isWhot ? 60 : 0;
  const shapeBonus = card.shape === activeShape ? -5 : 0;
  return specialPenalty + whotPenalty + shapeBonus + card.value;
}

function penaltyRank(card) {
  if (card.isWhot) return null;
  if (card.value === 2) return '2';
  if (card.value === 5) return '3';
  if (card.value === 14) return '14';
  return null;
}

function matchesActive(card, state) {
  return card.isWhot || card.shape === state.activeShape || card.value === state.topDiscard?.value;
}

function chooseMove(state, hand) {
  if (state.mustCallSuit) return { type: 'whot:call_suit', shape: bestShape(hand) };
  if (hand.length === 1 && !(state.lastCardAnnounced ?? []).includes(state.currentPlayerId)) {
    return { type: 'whot:announce_last_card' };
  }
  const continuation = state.penaltyContinuation;
  if (continuation?.seatId === state.currentPlayerId) {
    const sameRank = hand
      .filter((card) => penaltyRank(card) === continuation.rank)
      .sort((a, b) => cardScore(a, state.activeShape) - cardScore(b, state.activeShape))[0];
    if (sameRank) return { type: 'whot:play_card', cardId: sameRank.id };

    const continueCard = hand
      .filter((card) => !penaltyRank(card) && !card.isWhot && matchesActive(card, state))
      .sort((a, b) => cardScore(a, state.activeShape) - cardScore(b, state.activeShape))[0];
    if (continueCard) return { type: 'whot:play_card', cardId: continueCard.id };

    return { type: 'whot:draw_card' };
  }
  const pending = state.pendingDrawCount ?? 0;
  const legal = hand.filter((card) => {
    if (pending > 0) {
      if (state.pendingDrawRank === '2') return card.value === 2;
      if (state.pendingDrawRank === '3') return card.value === 5;
      return false;
    }
    if (hand.length === 1 && card.isWhot) return false;
    return matchesActive(card, state);
  });
  const winning = legal.find((card) => hand.length === 1 && !card.isWhot);
  const playable = winning ?? [...legal].sort((a, b) => cardScore(a, state.activeShape) - cardScore(b, state.activeShape))[0];
  if (playable) {
    const intent = { type: 'whot:play_card', cardId: playable.id };
    if (playable.isWhot) intent.calledShape = bestShape(hand.filter((c) => c.id !== playable.id));
    return intent;
  }
  return { type: 'whot:draw_card' };
}

async function joinAs({ client, code, deviceId, displayName, role, hostToken, gameType }) {
  return client.joinOrCreate(gameType ?? 'whot', {
    protocolVersion: PROTOCOL_VERSION,
    deviceId,
    displayName,
    role,
    hostToken,
    code,
    gameType,
  });
}

async function main() {
  step = 'create_whot_room';
  const hostDeviceId = `whot-host-${randomUUID()}`;
  const createRes = await fetch(`${HTTP_URL}/rooms`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ hostDeviceId, hostDisplayName: 'Whot Host', gameType: 'whot' }),
  });
  if (!createRes.ok) fail(`POST /rooms -> ${createRes.status}`);
  const { code, hostToken } = await createRes.json();
  const client = new Client(WS_URL);

  step = 'join_host';
  const host = attach(await joinAs({ client, code, deviceId: hostDeviceId, displayName: 'Host', role: 'host', hostToken, gameType: 'whot' }));
  await host.waitFor((s) => s.hostId === hostDeviceId && s.gameType === 'whot', 4000, 'host whot room');

  step = 'join_players';
  const p1Id = `whot-p1-${randomUUID()}`;
  const p2Id = `whot-p2-${randomUUID()}`;
  const p1 = attach(await joinAs({ client, code, deviceId: p1Id, displayName: 'Ada', role: 'player' }));
  const p2 = attach(await joinAs({ client, code, deviceId: p2Id, displayName: 'Bo', role: 'player' }));
  await host.waitFor((s) => s.members.some((m) => m.id === p1Id) && s.members.some((m) => m.id === p2Id), 4000, 'players joined');

  step = 'ready_and_start';
  p1.send({ type: 'toggle_ready' });
  p2.send({ type: 'toggle_ready' });
  await host.waitFor((s) => s.members.filter((m) => !m.isSpectator).every((m) => m.isReady), 4000, 'players ready');
  host.send({ type: 'host:start_game' });
  const playing = await host.waitFor((s) => s.status === 'playing' && s.whotState?.phase === 'playing', 8000, 'whot playing');
  if (!playing.whotState.players.every((p) => typeof p.handCount === 'number')) fail('missing public hand counts');

  step = 'ai_broadcast';
  host.send({ type: 'host:broadcast_commentary', line: 'Whot table heats up!' });
  await p1.waitForEvent((e) => e?.type === 'ai_commentary', 5000, 'p1 commentary');

  step = 'play_again_guard';
  host.send({ type: 'host:play_again' });
  await new Promise((r) => setTimeout(r, 500));
  if (host.last?.status !== 'playing') fail('play_again should not work before finish');

  step = 'finish_match';
  const controllers = new Map([
    [p1Id, p1],
    [p2Id, p2],
  ]);
  for (let i = 0; i < 500; i++) {
    const state = host.last;
    if (state?.status === 'finished') break;
    const currentId = state?.whotState?.currentPlayerId;
    const controller = controllers.get(currentId);
    if (controller) {
      const expectedHandCount = state.whotState.players.find((p) => p.id === currentId)?.handCount;
      const previousPrivateSeq = controller.privateSeq;
      controller.send({ type: 'request_state' });
      const privateState = await controller.waitForPrivate(
        (s, seq) => {
          if (seq <= previousPrivateSeq || !Array.isArray(s.whotState?.hand)) return false;
          if (typeof expectedHandCount !== 'number') return true;
          return s.whotState.hand.length === expectedHandCount;
        },
        3000,
        'current Whot hand',
      );
      const hand = privateState.whotState?.hand ?? [];
      const move = chooseMove(state.whotState, hand);
      controller.send(move);
      if (move.type === 'whot:announce_last_card') {
        await new Promise((r) => setTimeout(r, 150));
        continue;
      }
    }
    await host.waitFor((s) => s.whotState?.turnNumber !== state?.whotState?.turnNumber || s.status === 'finished', 5000, 'whot turn advanced');
  }
  if (host.last?.status !== 'finished') {
    const ws = host.last?.whotState;
    const counts = ws?.players?.map((p) => `${p.displayName}:${p.handCount}`).join(', ') ?? 'unknown';
    throw new Error(`Whot smoke did not finish within iteration budget; turn=${ws?.turnNumber}, drawPile=${ws?.drawPileCount}, current=${ws?.currentPlayerId}, hands=${counts}`);
  }
  const finished = await host.waitFor((s) => s.status === 'finished' && s.whotState?.winnerId, 8000, 'whot finished');
  const winnerId = finished.whotState.winnerId;

  step = 'recap_broadcast';
  host.send({ type: 'host:broadcast_recap', recap: { headline: 'Whot finished', paragraph: 'A tight table closed cleanly.', mvp: winnerId } });
  await p1.waitForEvent((e) => e?.type === 'ai_recap', 5000, 'p1 recap');

  step = 'reconnect_private_state';
  p1.leave();
  await new Promise((r) => setTimeout(r, 250));
  const p1Again = attach(await joinAs({ client, code, deviceId: p1Id, displayName: 'Ada', role: 'player', gameType: 'whot' }));
  await p1Again.waitFor((s) => s.members.some((m) => m.id === p1Id) && s.whotState?.phase === 'finished', 4000, 'p1 reconnect public');
  await new Promise((r) => setTimeout(r, 250));
  if (!Array.isArray(p1Again.privateState?.whotState?.hand)) fail('p1 reconnect missing private Whot hand');

  step = 'play_again_reset';
  host.send({ type: 'host:play_again' });
  await host.waitFor((s) => s.status === 'lobby' && !s.whotState, 4000, 'play again reset');

  host.leave();
  p1Again.leave();
  p2.leave();
  log('PASS');
  process.exit(0);
}

main().catch((err) => {
  console.error(`[whot-smoke] threw @ ${step}: ${err?.message ?? err}`);
  process.exit(1);
});
