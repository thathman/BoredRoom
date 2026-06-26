#!/usr/bin/env node
import { Client } from 'colyseus.js';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const HTTP_URL = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';
const GAME_IDS = [
  'bible-timeline',
  'color-wahala',
  'connect-4',
  'ettt',
  'faith-feud',
  'half-half',
  'hustle',
  'landlord',
  'logo',
  'ludo',
  'market-price',
  'pidgin-translator',
  'trivia',
  'whot',
  'word-wahala',
];

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function waitFor(label, predicate, timeout = 8_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = predicate();
    if (value) return value;
    await sleep(50);
  }
  throw new Error(`timeout waiting for ${label}`);
}

async function createSession() {
  const response = await fetch(`${HTTP_URL}/sessions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      hostDeviceId: `matrix-host-${Date.now()}`,
      settings: { allowBots: false, allowCrowdVotes: true, hintsEnabled: true, maxControllers: 12 },
    }),
  });
  assert(response.ok, `session_create_failed_${response.status}`);
  return response.json();
}

async function joinRoom(client, code, input) {
  const room = await client.joinOrCreate('house-session', { code, ...input });
  return room;
}

function wireRoom(room, bucket) {
  room.onMessage('session:state', (state) => { bucket.session = state; });
  room.onMessage('session:transition', (event) => { bucket.transition = event; });
  room.onMessage('game:public_state', (payload) => { bucket.public = payload; });
  room.onMessage('game:private_state', (payload) => { bucket.private = payload; });
  room.onMessage('session:error', (payload) => { bucket.errors.push(payload); });
}

function firstLegal(privateState, type) {
  const legal = privateState?.state?.legalIntents ?? privateState?.legalIntents ?? [];
  return legal.find((intent) => !type || intent.type === type) ?? null;
}

async function sendAndWait(room, bucket, intent, label, predicate = () => true) {
  const before = JSON.stringify(bucket.public?.state ?? {});
  room.send('game:intent', intent);
  await waitFor(label, () => {
    const after = JSON.stringify(bucket.public?.state ?? {});
    return after !== before && predicate(bucket.public?.state) ? bucket.public.state : null;
  });
}

async function finishRun(display, displayBucket) {
  display.send('session:end_game');
  await waitFor('run recap', () => displayBucket.session?.session?.status === 'recap' || displayBucket.session?.lastRecap);
}

async function startGame(display, displayBucket, buckets, gameId) {
  display.send('session:start_game', { gameId });
  await waitFor(`${gameId} public state`, () => {
    const ready = displayBucket.public?.gameType === gameId && displayBucket.public?.state?.gameType === gameId;
    const privates = buckets.every((bucket) => bucket.private?.gameType === gameId);
    return ready && privates ? displayBucket.public.state : null;
  }, 10_000);
}

async function advanceChallenge(display, displayBucket, buckets, gameId) {
  for (const bucket of buckets.slice(0, 2)) {
    const legal = firstLegal(bucket.private);
    assert(legal, `${gameId}: missing legal challenge intent`);
    const intent = legal.type === 'guess'
      ? { ...legal, amount: Number.isFinite(Number(legal.amount)) ? Number(legal.amount) : 1000 }
      : legal.type === 'answer_text'
        ? { ...legal, text: typeof legal.text === 'string' ? legal.text : 'lagos' }
        : { ...legal };
    bucket.room.send('game:intent', intent);
  }
  await waitFor(`${gameId} reveal`, () => ['reveal', 'finished'].includes(displayBucket.public?.state?.phase));
  assert((displayBucket.public.state.lastResults ?? []).length >= 2, `${gameId}: no scoring results`);
  display.send('game:intent', { type: 'advance' });
  await waitFor(`${gameId} next or finish`, () => displayBucket.public?.state?.phase === 'playing' || displayBucket.public?.state?.phase === 'finished');
}

async function verifyConnect4(buckets, displayBucket) {
  const [p1, p2] = buckets;
  for (const [bucket, column] of [[p1, 0], [p2, 0], [p1, 1], [p2, 1], [p1, 2], [p2, 2], [p1, 3]]) {
    await sendAndWait(bucket.room, displayBucket, { type: 'drop', column }, `connect4 column ${column}`);
  }
  const state = displayBucket.public.state;
  assert(state.phase === 'finished', 'connect-4 did not finish after four connected counters');
  assert(state.winningCells?.length === 4, 'connect-4 missing winning cells');
}

async function verifyEttt(buckets, displayBucket) {
  const [p1, p2] = buckets;
  for (const [bucket, cell] of [[p1, 0], [p2, 1], [p1, 4], [p2, 2], [p1, 8]]) {
    await sendAndWait(bucket.room, displayBucket, { type: 'place', cell }, `ettt cell ${cell}`);
  }
  assert(displayBucket.public.state.phase === 'finished', 'ettt did not finish on diagonal');
  assert(displayBucket.public.state.winnerPlayerIds?.length === 1, 'ettt missing winner');
}

async function verifyLudo(buckets, displayBucket) {
  const [p1] = buckets;
  p1.room.send('game:intent', { type: 'move_token', tokenIndex: 0 });
  await sleep(200);
  assert(displayBucket.public.state.pendingRoll == null, 'ludo accepted illegal move before roll');
  await sendAndWait(p1.room, displayBucket, { type: 'roll' }, 'ludo roll', (state) => state.pendingRoll === 6);
  await sendAndWait(p1.room, displayBucket, { type: 'move_token', tokenIndex: 0 }, 'ludo move', (state) => state.tokens?.[p1.deviceId]?.[0] === 0);
  assert(displayBucket.public.state.currentPlayerId === p1.deviceId, 'ludo should keep turn after rolling six');
}

async function verifyWhot(buckets, displayBucket) {
  const [p1, p2] = buckets;
  assert(!JSON.stringify(displayBucket.public.state).includes(p1.private.state.hand?.[0]?.id), 'whot leaked private hand into public state');
  const beforeMarket = displayBucket.public.state.drawPileCount;
  await sendAndWait(p1.room, displayBucket, { type: 'draw' }, 'whot market draw', (state) => state.drawPileCount === beforeMarket - 1);
  const legalPlay = firstLegal(p2.private, 'play_card');
  assert(legalPlay, 'whot expected p2 to have a legal play after p1 draws');
  await sendAndWait(p2.room, displayBucket, legalPlay, 'whot legal card play', (state) => state.topCard?.label === p2.private.state.hand?.find?.((card) => card.id === legalPlay.cardId)?.label || state.currentPlayerId !== p2.deviceId);
  const before = JSON.stringify(displayBucket.public.state);
  p1.room.send('game:intent', { type: 'play_card', cardId: 'not-in-hand' });
  await sleep(300);
  assert(JSON.stringify(displayBucket.public.state) === before, 'whot illegal card changed public state');
}

async function runBrowserSmoke(code, ownerCredential) {
  let chromium;
  try {
    ({ chromium } = await import('playwright'));
  } catch {
    console.warn('[pw-gameplay] playwright dependency missing; skipped browser page smoke');
    return;
  }
  const browser = await chromium.launch({ headless: true });
  const desktop = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const mobile = await browser.newContext({
    viewport: { width: 390, height: 844 },
    isMobile: true,
    hasTouch: true,
    userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1',
  });
  try {
    const host = await desktop.newPage();
    await host.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await host.evaluate(({ sessionCode, credential }) => {
      localStorage.setItem(`boredroom_session_owner:${sessionCode}`, credential);
    }, { sessionCode: code, credential: ownerCredential });
    await host.goto(`${BASE_URL}/session/${code}/display`, { waitUntil: 'networkidle' });
    await host.getByText(new RegExp(`House\\s+${code}`)).waitFor({ timeout: 8_000 });
    await host.screenshot({ path: '/tmp/boredroom-gameplay-host.png', fullPage: false });

    const controller = await mobile.newPage();
    await controller.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
    await controller.evaluate(({ sessionCode }) => {
      localStorage.setItem('boredroom_player_id', `browser-controller-${sessionCode}`);
      localStorage.setItem('boredroom_player_name', 'Browser Ada');
    }, { sessionCode: code });
    await controller.goto(`${BASE_URL}/session/${code}/controller`, { waitUntil: 'networkidle' });
    await controller.getByRole('heading', { name: /Waiting to play|Game complete|Your turn/i }).waitFor({ timeout: 8_000 });
    await controller.screenshot({ path: '/tmp/boredroom-gameplay-controller.png', fullPage: false });
  } finally {
    await desktop.close();
    await mobile.close();
    await browser.close();
  }
}

const catalog = await fetch(`${HTTP_URL}/games/catalog`).then((res) => res.json());
const installed = catalog.games.filter((game) => game.installed).map((game) => game.id);
assert(GAME_IDS.every((id) => installed.includes(id)), `not all matrix games are installed: ${installed.join(', ')}`);

const created = await createSession();
const code = created.session.code;
const client = new Client(WS_URL);
const displayBucket = { errors: [] };
const display = await joinRoom(client, code, {
  deviceId: `matrix-display-${code}`,
  displayName: 'Matrix display',
  role: 'display',
  ownerCredential: created.ownerCredential,
});
wireRoom(display, displayBucket);

const controllerBuckets = [];
for (const [index, name] of ['Ada', 'Tobi', 'Zainab', 'Kunle'].entries()) {
  const bucket = { errors: [], deviceId: `matrix-p${index + 1}-${code}` };
  const room = await joinRoom(client, code, {
    deviceId: bucket.deviceId,
    displayName: name,
    role: 'controller',
  });
  bucket.room = room;
  wireRoom(room, bucket);
  room.send('session:ready', { ready: true });
  controllerBuckets.push(bucket);
}

await waitFor('controllers ready', () => displayBucket.session?.members?.filter((member) => member.role === 'controller' && member.ready).length >= 4);
await runBrowserSmoke(code, created.ownerCredential);

for (const gameId of GAME_IDS) {
  await startGame(display, displayBucket, controllerBuckets, gameId);
  const mode = displayBucket.public.state.mode;
  if (gameId === 'connect-4') await verifyConnect4(controllerBuckets, displayBucket);
  else if (gameId === 'ettt') await verifyEttt(controllerBuckets, displayBucket);
  else if (gameId === 'ludo') await verifyLudo(controllerBuckets, displayBucket);
  else if (gameId === 'whot') await verifyWhot(controllerBuckets, displayBucket);
  else await advanceChallenge(display, displayBucket, controllerBuckets, gameId);
  assert(displayBucket.public.state.gameType === gameId, `${gameId}: game type changed unexpectedly`);
  assert(mode === displayBucket.public.state.mode, `${gameId}: mode changed unexpectedly`);
  await finishRun(display, displayBucket);
  console.log(`[pw-gameplay] ${gameId} PASS`);
}

await Promise.all(controllerBuckets.map((bucket) => bucket.room.leave()));
await display.leave();
console.log(`[pw-gameplay] PASS ${GAME_IDS.length} games through ${code}`);
