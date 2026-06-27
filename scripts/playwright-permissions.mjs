#!/usr/bin/env node
// Permission smoke: a non-host controller must not be able to run host-only session actions
// (kick, admit, end party, toggle remote mode). The server silently ignores them.
import { Client } from '@colyseus/sdk';

const HTTP_URL = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const WS_URL = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

const res = await fetch(`${HTTP_URL}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hostDeviceId: `perm-host-${Date.now()}` }),
});
assert(res.ok, `session_create_failed_${res.status}`);
const created = await res.json();
const code = created.session.code;
const client = new Client(WS_URL);

let state = null;
const host = await client.joinOrCreate('house-session', {
  code, deviceId: `perm-display-${code}`, displayName: 'Display', role: 'display', ownerCredential: created.ownerCredential,
});
host.onMessage('session:state', (s) => { state = s; });
const ada = await client.joinOrCreate('house-session', { code, deviceId: `perm-ada-${code}`, displayName: 'Ada', role: 'controller' });
await client.joinOrCreate('house-session', { code, deviceId: `perm-bob-${code}`, displayName: 'Bob', role: 'controller' });
await sleep(500);

const before = state.members.filter((m) => m.role === 'controller').length;
ada.send('session:kick_player', { deviceId: `perm-bob-${code}` });
ada.send('session:end_party');
ada.send('session:set_remote_mode', { enabled: false });
ada.send('session:admit_player', { deviceId: `perm-bob-${code}` });
await sleep(700);

assert(state.members.filter((m) => m.role === 'controller').length === before, 'controller kicked a player');
assert(state.session.status !== 'ended', 'controller ended the party');
assert(state.session.settings.allowRemote !== false, 'controller toggled remote mode');

await host.leave();
console.log(`[pw-perms] PASS non-host host-only actions ignored through ${code}`);
process.exit(0);
