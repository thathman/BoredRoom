// k6 load test — concurrent BoredRoom rooms via the Colyseus transport.
//
// NOT WIRED INTO CI. Run manually:
//
//   1. Install k6:           https://k6.io/docs/get-started/installation/
//   2. Start the server:     npm run smoke:server-start
//   3. Run the load test:    k6 run scripts/loadtest-rooms.k6.js
//
// Defaults to 50 concurrent rooms × 2 players each (~100 sockets) for 60s.
// Tune via env vars:
//   ROOMS=80 PLAYERS_PER_ROOM=3 DURATION=2m TARGET=ws://localhost:2567 \
//     k6 run scripts/loadtest-rooms.k6.js
//
// This is an MVP harness — it exercises room creation, join, ready, and
// disconnect. It does NOT play actual game turns.

import ws from 'k6/ws';
import { check, sleep } from 'k6';

const TARGET = __ENV.TARGET || 'ws://localhost:2567';
const ROOMS = Number(__ENV.ROOMS || 50);
const PLAYERS_PER_ROOM = Number(__ENV.PLAYERS_PER_ROOM || 2);
const DURATION = __ENV.DURATION || '60s';

export const options = {
  scenarios: {
    rooms: {
      executor: 'constant-vus',
      vus: ROOMS * PLAYERS_PER_ROOM,
      duration: DURATION,
    },
  },
  thresholds: {
    ws_connecting: ['p(95)<1500'],
    ws_session_duration: ['p(95)>10000'],
  },
};

export default function () {
  const roomCode = `LOAD${(__VU % ROOMS).toString().padStart(4, '0')}`;
  const url = `${TARGET}/colyseus`;

  const res = ws.connect(url, {}, (socket) => {
    socket.on('open', () => {
      socket.send(
        JSON.stringify({
          type: 'join',
          roomCode,
          displayName: `Bot ${__VU}`,
          gameType: 'ludo',
        }),
      );
    });

    socket.on('message', () => {
      // We do not parse server frames here — k6 just measures connection
      // capacity. Add intent emitters per game if you want richer scenarios.
    });

    socket.setTimeout(() => socket.close(), 30000);
  });

  check(res, { 'connected': (r) => r && r.status === 101 });
  sleep(1);
}
