#!/usr/bin/env node
import { Client } from '@colyseus/sdk';
import { chromium } from 'playwright';
import { MONEY_TRIVIA_SEED } from '../server/dist/server/src/content/moneyTriviaBank.js';
import { MONEY_TRIVIA_FF_SEED } from '../server/dist/server/src/content/moneyTriviaFastestFinger.js';

const BASE = process.env.PLAYWRIGHT_BASE_URL ?? 'http://127.0.0.1:8088';
const HTTP = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));
function assert(value, message) { if (!value) throw new Error(message); }
async function waitFor(label, read, timeout = 20_000) {
  const started = Date.now();
  while (Date.now() - started < timeout) {
    const value = read();
    if (value) return value;
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
  room.onMessage('ai:result', () => {});
  room.onMessage('session:payout_marked', () => {});
}

const createdResponse = await fetch(`${HTTP}/sessions`, {
  method: 'POST', headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hostDeviceId: `money-live-${Date.now()}`, settings: { allowBots: false, allowCrowdVotes: true, maxControllers: 12 } }),
});
assert(createdResponse.ok, `session create failed: ${createdResponse.status}`);
const created = await createdResponse.json();
const code = created.session.code;
const client = new Client(WS);
const host = { errors: [], deviceId: `host-${code}` };
host.room = await client.joinOrCreate('house-session', { code, deviceId: host.deviceId, displayName: 'Money host', role: 'display', ownerCredential: created.ownerCredential });
wire(host.room, host);

const players = [];
for (const [index, name] of ['Ada', 'Obi', 'Zainab', 'Tobi'].entries()) {
  const bucket = { errors: [], deviceId: `money-p${index + 1}-${code}` };
  bucket.room = await client.joinOrCreate('house-session', { code, deviceId: bucket.deviceId, displayName: name, role: 'controller' });
  wire(bucket.room, bucket);
  bucket.room.send('session:ready', { ready: true });
  players.push(bucket);
}
await waitFor('four ready players', () => host.session?.members?.filter((member) => member.role === 'controller' && member.ready).length === 4);

const pairingResponse = await fetch(`${HTTP}/sessions/${code}/pairing`, { method: 'POST', headers: { 'x-boredroom-owner': created.ownerCredential } });
assert(pairingResponse.ok, `pairing create failed: ${pairingResponse.status}`);
const pairing = await pairingResponse.json();
const redeemResponse = await fetch(`${HTTP}/sessions/${code}/pairing/redeem`, {
  method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify({ pairingCode: pairing.pairingCode }),
});
assert(redeemResponse.ok, `pairing redeem failed: ${redeemResponse.status}`);
const redeemed = await redeemResponse.json();
const companion = { errors: [], deviceId: `companion-${code}` };
companion.room = await client.joinOrCreate('house-session', { code, deviceId: companion.deviceId, displayName: 'Companion', role: 'companion', ownerCredential: redeemed.companionCredential });
wire(companion.room, companion);

host.room.send('session:start_game', { gameId: 'trivia', settings: {
  ageBand: 'adult', startingPrize: 100, topPrize: 5000, safetyNets: [5, 10], fastestFingerSeconds: 15,
  questionSeconds: 60, timeoutOutcome: 'walk_away', hostFundedConfirmed: true,
  lifelines: { fifty_fifty: true, ask_room: true, ask_player: true, ask_host: true },
} });
await waitFor('Money Trivia start', () => host.public?.state?.mode === 'money-trivia' && players.every((player) => player.private?.gameType === 'trivia'));
assert(host.public.state.phase === 'fastest_finger', 'Money Trivia did not begin at Fastest Finger');
assert(host.public.state.ladder.length === 15 && host.public.state.ladder.at(-1) === 5000, 'cash ladder incorrect');

const publicRunJson = JSON.stringify(host.session?.activeRun ?? {});
for (const forbidden of ['questions', 'fastestFingerQuestions', 'answerIndex', 'correctOrder', 'aiQuestions']) {
  assert(!publicRunJson.includes(forbidden), `public session leaked ${forbidden}`);
}
assert(!/correctIndex|correctOrder|\"answer\"\s*:/.test(JSON.stringify([host.public, ...players.map((player) => player.private), companion.private])), 'pre-reveal projection leaked an answer key');

const ff = host.public.state.fastestFinger;
const ffSource = MONEY_TRIVIA_FF_SEED.find((question) => question.prompt === ff.prompt);
assert(ffSource, `reviewed Fastest Finger question not found: ${ff.prompt}`);
const correctOrder = ffSource.options.map((text) => ff.options.indexOf(text));
assert(correctOrder.every((index) => index >= 0), 'could not map Fastest Finger display order');
players[0].room.send('game:intent', { type: 'fastest_finger_submit', order: correctOrder });
await sleep(180);
for (const player of players.slice(1)) player.room.send('game:intent', { type: 'fastest_finger_submit', order: [...correctOrder].reverse() });
await waitFor('Ada hot seat', () => host.public?.state?.phase === 'hot_seat' && host.public.state.contestant?.id === players[0].deviceId);
await waitFor('private hot-seat roles', () => players[0].private?.state?.isContestant
  && players.slice(1).every((player) => player.private?.state?.role === 'audience'));

const question = host.public.state.question;
const source = MONEY_TRIVIA_SEED.find((item) => item.prompt === question.prompt);
assert(source, `reviewed hot-seat question not found: ${question.prompt}`);
const correctText = source.options[source.answer];
const correctIndex = question.options.find((option) => option.label === correctText)?.index;
assert(Number.isInteger(correctIndex), 'could not map correct hot-seat answer');

players[0].room.send('game:intent', { type: 'use_lifeline', lifeline: 'fifty_fifty' });
await waitFor('50:50', () => host.public?.state?.question?.options?.filter((option) => option.removed).length === 2);
assert(!host.public.state.question.options.find((option) => option.index === correctIndex)?.removed, '50:50 removed the correct answer');
const available = host.public.state.question.options.filter((option) => !option.removed).map((option) => option.index);

players[0].room.send('game:intent', { type: 'use_lifeline', lifeline: 'ask_room' });
await waitFor('Ask Room open', () => host.public?.state?.lifeline?.type === 'ask_room');
assert(host.public.state.questionDeadline == null, 'question timer did not pause for Ask Room');
for (const [index, player] of players.slice(1).entries()) player.room.send('game:intent', { type: 'audience_vote', optionIndex: available[index % available.length] });
await waitFor('three room votes', () => host.public?.state?.lifeline?.votesCast === 3);
await waitFor('Ask Room auto close', () => host.public?.state?.lifeline == null, 20_000);
assert(host.public.state.questionDeadline > Date.now() + 14_000, 'question timer did not resume with at least 15 seconds');

players[0].room.send('game:intent', { type: 'use_lifeline', lifeline: 'ask_player', targetPlayerId: players[1].deviceId });
await waitFor('Ask Player helper', () => players[1].private?.state?.isHelper === true);
players[1].room.send('game:intent', { type: 'friend_answer', optionIndex: available[0], confidence: 82 });
await waitFor('Ask Player recommendation', () => host.public?.state?.lastLifelineHint?.recommendation?.confidence === 82 && host.public?.state?.lifeline == null);

players[0].room.send('game:intent', { type: 'use_lifeline', lifeline: 'ask_host' });
await waitFor('Ask Host open', () => companion.public?.state?.lifeline?.type === 'ask_host');
host.room.send('game:intent', { type: 'host_answer', optionIndex: available[0], confidence: 67 });
await waitFor('Ask Host recommendation', () => host.public?.state?.lastLifelineHint?.recommendation?.confidence === 67 && host.public?.state?.lifeline == null);

const browser = await chromium.launch({ headless: true });
const desktop = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const hostPage = await desktop.newPage();
await hostPage.goto(BASE, { waitUntil: 'domcontentloaded' });
await hostPage.evaluate(({ sessionCode, credential }) => localStorage.setItem(`boredroom_session_owner:${sessionCode}`, credential), { sessionCode: code, credential: created.ownerCredential });
await hostPage.goto(`${BASE}/session/${code}/display`, { waitUntil: 'networkidle' });
await hostPage.getByText('Money Trivia', { exact: false }).first().waitFor({ timeout: 15_000 });
await hostPage.getByText(/Money ladder/i).waitFor();
assert(await hostPage.getByRole('button', { name: /Reveal answer/i }).count() === 0, 'display controls visible while companion connected');
await hostPage.screenshot({ path: '/tmp/money-trivia-live-host.png', fullPage: true });

const mobile = await browser.newContext({ viewport: { width: 390, height: 844 }, screen: { width: 390, height: 844 }, isMobile: true, hasTouch: true, userAgent: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile/15E148 Safari/604.1' });
const controllerPage = await mobile.newPage();
await controllerPage.goto(BASE, { waitUntil: 'domcontentloaded' });
await controllerPage.evaluate(({ playerId }) => {
  localStorage.setItem('boredroom_player_id', playerId);
  localStorage.setItem('boredroom_player_profile', JSON.stringify({ id: playerId, displayName: 'Ada', avatarType: 'emoji', avatarValue: '💰', accentColor: '#45f36b', preferences: { sound: true, haptics: true, language: 'en' }, stats: { gamesPlayed: 0, wins: 0, currentStreak: 0, bestStreak: 0 }, updatedAt: new Date().toISOString() }));
}, { playerId: players[0].deviceId });
await controllerPage.goto(`${BASE}/session/${code}/controller`, { waitUntil: 'networkidle' });
await controllerPage.getByText(/in the hot seat/i).waitFor({ timeout: 15_000 });
await controllerPage.getByRole('button', { name: /Final answer/i }).waitFor();
await controllerPage.screenshot({ path: '/tmp/money-trivia-live-controller.png', fullPage: true });

players[0].room.send('game:intent', { type: 'select_answer', optionIndex: correctIndex });
await waitFor('answer selected', () => host.public?.state?.selectedOption === correctIndex);
players[0].room.send('game:intent', { type: 'lock_answer' });
await waitFor('answer locked', () => host.public?.state?.reveal?.pending === true);
await waitFor('four-second automatic reveal', () => host.public?.state?.reveal?.pending === false, 8_000);
assert(host.public.state.reveal.correct === true, 'known correct answer did not score');
host.room.send('game:intent', { type: 'advance' });
await waitFor('question two', () => host.public?.state?.level === 1 && host.public.state.reveal == null);
players[0].room.send('game:intent', { type: 'walk_away' });
await waitFor('cash recap', () => host.session?.lastRecap?.result?.earnedAmount === 100, 10_000);
assert(host.session.lastRecap.result.settlementStatus === 'unsettled', 'initial settlement status incorrect');
host.room.send('session:mark_payout', { settlementStatus: 'paid' });
await waitFor('paid settlement', () => host.session?.lastRecap?.result?.settlementStatus === 'paid');

await hostPage.reload({ waitUntil: 'networkidle' });
await hostPage.getByText(/₦100/).first().waitFor({ timeout: 15_000 });
await hostPage.getByText(/paid/i).first().waitFor();
await hostPage.screenshot({ path: '/tmp/money-trivia-live-recap.png', fullPage: true });

assert(host.errors.length === 0, `host errors: ${JSON.stringify(host.errors)}`);
assert(players.every((player) => player.errors.length === 0), `player errors: ${JSON.stringify(players.flatMap((player) => player.errors))}`);
await mobile.close(); await desktop.close(); await browser.close();
await companion.room.leave();
for (const player of players) await player.room.leave();
await host.room.leave();
console.log(`[pw-money-trivia] PASS through ${code}`);
