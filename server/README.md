# BoredRoom Game Server

Colyseus-based authoritative game server. Pairs with the Vite web client at the repo root.

## Architecture

- **Colyseus** owns: room lifecycle, presence/reconnect, websocket transport, authoritative session state, admission policy, moderation.
- **boardgame.io** is used as a **rules library only** (see `../shared/src/rules`). No bgio Client, Server, lobby, or transport is used.
- Clients send **intents only**. The server validates every action and broadcasts **public** state to everyone, **private** state only to the owning seat.
- The host is **never a playable seat**. The host appears as `hostId` and may issue moderation intents (`host:*`).

## Local dev

```bash
cd server
npm install
npm run dev      # tsx watch on :2567
```

Or with Docker Compose from the repo root:
```bash
docker compose up --build
# web   → http://localhost:8088
# server → ws://localhost:2567
```

Point the web client at the server by setting `VITE_TRANSPORT=colyseus` and `VITE_COLYSEUS_URL=ws://localhost:2567` in `.env.local` at the repo root.

## Endpoints

- `POST /rooms` — create a room and receive a one-time `hostToken` bound to the host's `deviceId`.
- `GET /healthz` — liveness probe.
- WebSocket `ws://host:2567/` — Colyseus matchmaking + room join.

## Auth model

Hybrid:
- Players: send `deviceId` + `displayName` (no real auth, matches existing app).
- Hosts: must present the one-time `hostToken` from `POST /rooms`. Tokens are device-bound; same device may reconnect after first use.
