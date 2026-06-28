#!/usr/bin/env node
import { Client } from '@colyseus/sdk';
import { chromium } from 'playwright';

const BASE_URL = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const HTTP_URL = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function waitFor(label, predicate, timeout = 10_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const result = predicate();
    if (result) return result;
    await sleep(50);
  }
  throw new Error(`timeout waiting for ${label}`);
}
function wire(room, bucket) {
  room.onMessage('session:state', (value) => { bucket.session = value; });
  room.onMessage('session:transition', () => {});
  room.onMessage('game:public_state', (value) => { bucket.public = value; });
  room.onMessage('game:private_state', (value) => { bucket.private = value; });
  room.onMessage('session:error', (value) => { bucket.errors.push(value); });
}

const createdResponse = await fetch(`${HTTP_URL}/sessions`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hostDeviceId: `whot-flow-${Date.now()}`, settings: { allowBots: true, hintsEnabled: true, allowCrowdVotes: false, maxControllers: 12 } }),
});
assert(createdResponse.ok, `session create failed: ${createdResponse.status}`);
const created = await createdResponse.json();
const code = created.session.code;
const client = new Client(WS_URL);
const hostBucket = { errors: [] };
const host = await client.joinOrCreate('house-session', { code, deviceId: `host-${code}`, displayName: 'Whot host', role: 'display', ownerCredential: created.ownerCredential });
wire(host, hostBucket);

const players = [];
for (const [index, name] of ['Ada', 'Obi'].entries()) {
  const bucket = { errors: [], deviceId: `whot-p${index + 1}-${code}` };
  bucket.room = await client.joinOrCreate('house-session', { code, deviceId: bucket.deviceId, displayName: name, role: 'controller' });
  wire(bucket.room, bucket);
  bucket.room.send('session:ready', { ready: true });
  players.push(bucket);
}
await waitFor('ready Whot players', () => hostBucket.session?.members?.filter((member) => member.role === 'controller' && member.ready).length === 2);

host.send('session:start_game', { gameId: 'whot', settings: {
  seed: 42, timerMs: 1_200, turnSeconds: 1, pickDefence: 'no_stack',
  allowSpecialFinish: false, timeoutPenalty: 'draw_and_pass', specialCards: true,
} });
await waitFor('Whot start', () => hostBucket.public?.state?.mode === 'whot' && players.every((player) => player.private?.gameType === 'whot'));
assert(hostBucket.public.state.settings.pickDefence === 'no_stack', 'Whot pick-defence setting not applied');
assert(hostBucket.public.state.settings.allowSpecialFinish === false, 'Whot finish setting not applied');
assert(hostBucket.public.paceDeadline > Date.now(), 'Whot deadline not projected to clients');

host.send('session:pause_game', { reason: 'e2e_pause' });
await waitFor('paused Whot', () => hostBucket.session?.activeRun?.status === 'paused' && hostBucket.public?.paceDeadline == null);
const pausedState = JSON.stringify(hostBucket.public.state);
await sleep(1_600);
assert(JSON.stringify(hostBucket.public.state) === pausedState, 'Whot advanced while paused');

host.send('session:resume_game');
await waitFor('resumed deadline', () => hostBucket.session?.activeRun?.status === 'active' && hostBucket.public?.paceDeadline > Date.now());
const playerBeforeTimeout = hostBucket.public.state.currentPlayerId;
await waitFor('Whot timeout penalty', () => hostBucket.public?.state?.currentPlayerId !== playerBeforeTimeout, 5_000);
assert(/ran out of time/i.test(hostBucket.public.state.lastAction), 'timeout explanation missing');

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const hostPage = await desktop.newPage();
await hostPage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await hostPage.evaluate(({ sessionCode, credential }) => localStorage.setItem(`boredroom_session_owner:${sessionCode}`, credential), { sessionCode: code, credential: created.ownerCredential });
await hostPage.goto(`${BASE_URL}/session/${code}/display`, { waitUntil: 'networkidle' });
await hostPage.getByText(/Whot/).first().waitFor();
await hostPage.getByRole('button', { name: /Games & controls/i }).waitFor({ timeout: 8_000 });
await hostPage.getByRole('button', { name: /^Join$/i }).waitFor({ timeout: 8_000 });
assert(await hostPage.getByText('Join house', { exact: true }).count() === 0, 'persistent Join house overlay still blocks gameplay');
await hostPage.getByRole('button', { name: /^Join$/i }).click();
await hostPage.getByRole('dialog', { name: 'Join this house' }).waitFor();
await hostPage.getByRole('button', { name: 'Close join details' }).click();

const pairingResponse = await fetch(`${HTTP_URL}/sessions/${code}/pairing`, { method: 'POST', headers: { 'x-boredroom-owner': created.ownerCredential } });
assert(pairingResponse.ok, `pairing create failed: ${pairingResponse.status}`);
const pairing = await pairingResponse.json();
const redeemResponse = await fetch(`${HTTP_URL}/sessions/${code}/pairing/redeem`, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairingCode: pairing.pairingCode }) });
assert(redeemResponse.ok, `pairing redeem failed: ${redeemResponse.status}`);
const redeemed = await redeemResponse.json();
const companion = await client.joinOrCreate('house-session', { code, deviceId: `companion-${code}`, displayName: 'Companion', role: 'companion', ownerCredential: redeemed.companionCredential });
await waitFor('companion member', () => hostBucket.session?.members?.some((member) => member.role === 'companion' && member.connected));
await hostPage.reload({ waitUntil: 'networkidle' });
await hostPage.getByText(/Whot/).first().waitFor();
assert(await hostPage.getByRole('button', { name: /Games & controls/i }).count() === 0, 'host controls remain visible with companion connected');
assert(await hostPage.getByRole('button', { name: /^Join$/i }).count() === 0, 'host Join control remains visible with companion connected');

await players[0].room.leave();
const portrait = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
const controller = await portrait.newPage();
await controller.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await controller.evaluate(({ sessionCode, playerId }) => {
  localStorage.setItem('boredroom_player_id', playerId);
  localStorage.setItem('boredroom_player_profile', JSON.stringify({ id: playerId, displayName: 'Ada', avatarType: 'emoji', avatarValue: '🧠', accentColor: '#45f36b', preferences: { sound: true, haptics: true, language: 'en' }, stats: { gamesPlayed: 0, wins: 0, currentStreak: 0, bestStreak: 0 }, updatedAt: new Date().toISOString() }));
}, { sessionCode: code, playerId: players[0].deviceId });
await controller.goto(`${BASE_URL}/session/${code}/controller`, { waitUntil: 'networkidle' });
await controller.getByText(/Whot controller/i).waitFor();
assert(await controller.getByRole('button', { name: 'Request game pause' }).isVisible(), 'visible controller pause control missing');
assert(await controller.getByRole('button', { name: 'Open personal game assistant' }).isVisible(), 'assistant chat bubble missing');
assert(await controller.getByText(/Keeping the controller awake/i).count() === 0, 'obsolete wake-lock notice is visible');
assert(await controller.getByText('Players', { exact: true }).count() === 0, 'host player rail leaked onto controller');

const landscape = await browser.newContext({ viewport: { width: 844, height: 390 }, screen: { width: 844, height: 390 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/126 Mobile Safari/537.36' });
const landscapePage = await landscape.newPage();
await landscapePage.goto(BASE_URL, { waitUntil: 'domcontentloaded' });
await landscapePage.evaluate(({ sessionCode }) => {
  const id = `landscape-${sessionCode}`;
  localStorage.setItem('boredroom_player_id', id);
  localStorage.setItem('boredroom_player_profile', JSON.stringify({ id, displayName: 'Landscape', avatarType: 'emoji', avatarValue: '📱', accentColor: '#45f36b', preferences: { sound: true, haptics: true, language: 'en' }, stats: { gamesPlayed: 0, wins: 0, currentStreak: 0, bestStreak: 0 }, updatedAt: new Date().toISOString() }));
}, { sessionCode: code });
await landscapePage.goto(`${BASE_URL}/session/${code}/controller`, { waitUntil: 'networkidle' });
await landscapePage.getByRole('heading', { name: 'Turn your phone upright' }).waitFor();

await landscape.close();
await portrait.close();
await desktop.close();
await browser.close();
await companion.leave();
await players[1].room.leave();
await host.leave();
console.log(`[pw-whot] PASS through ${code}`);
