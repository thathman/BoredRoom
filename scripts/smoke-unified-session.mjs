import { Client } from '@colyseus/sdk';

const httpBase = process.env.BOREDROOM_HTTP_URL ?? 'http://127.0.0.1:2567';
const wsBase = process.env.BOREDROOM_WS_URL ?? 'ws://127.0.0.1:2567';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const createdResponse = await fetch(`${httpBase}/sessions`, {
  method: 'POST',
  headers: { 'content-type': 'application/json' },
  body: JSON.stringify({ hostDeviceId: 'smoke-host', settings: { allowBots: true } }),
});
assert(createdResponse.ok, `session creation failed: ${createdResponse.status}`);
const created = await createdResponse.json();
assert(/^[A-HJ-KM-NP-Z2-9]{4}$/.test(created.session.code), 'session code is not four unambiguous characters');
assert(typeof created.ownerCredential === 'string' && created.ownerCredential.length > 20, 'owner credential missing');

const removedRoomsResponse = await fetch(`${httpBase}/rooms`);
assert(removedRoomsResponse.status === 404, 'obsolete /rooms API is still available');

const client = new Client(wsBase);
const display = await client.joinOrCreate('house-session', {
  code: created.session.code,
  deviceId: 'smoke-host',
  displayName: 'Smoke display',
  role: 'display',
  ownerCredential: created.ownerCredential,
});
const controller = await client.joinOrCreate('house-session', {
  code: created.session.code,
  deviceId: 'smoke-controller',
  displayName: 'Ada',
  role: 'controller',
});

const snapshot = await new Promise((resolve, reject) => {
  const timeout = setTimeout(() => reject(new Error('session state timeout')), 4000);
  controller.onMessage('session:state', (state) => {
    if (state.members.some((member) => member.deviceId === 'smoke-controller')) {
      clearTimeout(timeout);
      resolve(state);
    }
  });
  controller.send('session:ready', { ready: true });
  controller.send('session:request_state');
});

assert(snapshot.activeRun === null, 'fresh session unexpectedly has a run');
assert(!JSON.stringify(snapshot).includes('ownerCredential'), 'public session leaked owner credential');
assert(!JSON.stringify(snapshot).includes('runtimeId'), 'public session leaked secondary runtime id');
assert(!JSON.stringify(snapshot).includes('roomCode'), 'public session leaked secondary room code');

await controller.leave();
await display.leave();
console.log(`Unified session smoke passed for ${created.session.code}`);
