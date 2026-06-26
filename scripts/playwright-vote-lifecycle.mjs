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
  room.onMessage('session:transition', (event) => { bucket.transitions.push(event); });
  room.onMessage('session:error', (payload) => { bucket.errors.push(payload); });
}

const response = await fetch(`${HTTP_URL}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({
    hostDeviceId: `vote-host-${Date.now()}`,
    settings: { allowBots: false, allowCrowdVotes: false, hintsEnabled: true, maxControllers: 8 },
  }),
});
assert(response.ok, `session_create_failed_${response.status}`);
const created = await response.json();
const code = created.session.code;

const client = new Client(WS_URL);
const hostBucket = { transitions: [], errors: [] };
const adaBucket = { transitions: [], errors: [] };
const tobiBucket = { transitions: [], errors: [] };

const host = await client.joinOrCreate('house-session', {
  code,
  deviceId: `vote-display-${code}`,
  displayName: 'Vote smoke display',
  role: 'display',
  ownerCredential: created.ownerCredential,
});
wireRoom(host, hostBucket);

const ada = await client.joinOrCreate('house-session', {
  code,
  deviceId: `vote-ada-${code}`,
  displayName: 'Ada',
  role: 'controller',
});
wireRoom(ada, adaBucket);

const tobi = await client.joinOrCreate('house-session', {
  code,
  deviceId: `vote-tobi-${code}`,
  displayName: 'Tobi',
  role: 'controller',
});
wireRoom(tobi, tobiBucket);

await waitFor('two controllers joined', () => {
  const controllers = hostBucket.session?.members?.filter((member) => member.role === 'controller') ?? [];
  return controllers.length >= 2 ? controllers : null;
});

host.send('session:call_vote', {
  type: 'game_selection',
  question: 'Next game?',
  options: ['Whot', 'Ludo'],
  settings: { quorum: 1, timerMs: 20_000, majorityThreshold: 0.5 },
});

await waitFor('active vote opened', () => hostBucket.session?.activeVote?.status === 'open');

ada.send('vote:cast', { option: 'Ludo' });
tobi.send('vote:cast', { option: 'Ludo' });

const result = await waitFor('vote resolved', () => {
  const activeVote = hostBucket.session?.activeVote;
  return activeVote?.status === 'resolved' && activeVote.result?.winnerOption === 'Ludo'
    ? activeVote.result
    : null;
});

assert(result.voteCounts.Ludo === 2, `unexpected_tally_${JSON.stringify(result.voteCounts)}`);
assert((hostBucket.session?.voteHistory ?? []).some((item) => item.voteId === result.voteId), 'vote_history_missing');
assert(hostBucket.errors.length === 0, `host_errors_${JSON.stringify(hostBucket.errors)}`);
assert(adaBucket.errors.length === 0, `ada_errors_${JSON.stringify(adaBucket.errors)}`);
assert(tobiBucket.errors.length === 0, `tobi_errors_${JSON.stringify(tobiBucket.errors)}`);

// Scenario 2: a player requests a vote, then the host overrides the winner.
ada.send('vote:request', { type: 'custom', question: 'Short break?', options: ['Yes', 'No'] });
const requested = await waitFor('player-requested vote opened', () => {
  const activeVote = hostBucket.session?.activeVote;
  return activeVote?.status === 'open' && activeVote.question === 'Short break?' ? activeVote : null;
});
assert(requested.createdBy === `vote-ada-${code}`, `request_creator_${requested.createdBy}`);

host.send('vote:override', { option: 'No', reason: 'host call' });
const overridden = await waitFor('host override resolved', () => {
  const activeVote = hostBucket.session?.activeVote;
  return activeVote?.status === 'resolved' && activeVote.result?.hostOverride ? activeVote.result : null;
});
assert(overridden.winnerOption === 'No', `override_winner_${overridden.winnerOption}`);
assert(overridden.hostOverride?.option === 'No', 'override_metadata_missing');

assert(hostBucket.errors.length === 0, `host_errors_2_${JSON.stringify(hostBucket.errors)}`);
assert(adaBucket.errors.length === 0, `ada_errors_2_${JSON.stringify(adaBucket.errors)}`);

await host.leave();
await ada.leave();
await tobi.leave();

console.log(`[pw-votes] PASS vote ${result.voteId} resolved, request ${requested.id} overridden through ${code}`);
