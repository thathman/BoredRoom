# BoredRoom Architecture

## Current Deployment
- Web app: `https://party.hendrix.com.ng`
- Realtime server: `https://colyseus.hendrix.com.ng`
- Host machine: Dell (`ssh dell`)
- Runtime: Docker Compose (`boredroom-web`, `boredroom-server`)

## System Topology
- Root web app (Vite + React + TypeScript)
- `server/` Node Colyseus authoritative game server
- `shared/` transport contracts + deterministic rules adapter
- Supabase remains auxiliary (auth/history paths), not realtime authority for primary gameplay

## Authority and Data Model
- Colyseus server is authoritative for room/game state.
- Clients send intents only (`host:*`, `roll_dice`, `move_token`, etc.).
- Public state is broadcast room-wide; private state is sent per seat.
- Host is display-only and is never a playable seat.

## Two-Screen Contract
- Display (`/host`, display view in `/room/:code`): host orchestration + public board/state only.
- Controller (`/join`, player view in `/room/:code`): private controls + player-scoped state.
- No private controller state may appear on display projection.

## Transport Strategy
- Primary: Colyseus (`VITE_COLYSEUS_URL` set).
- Fallback: Supabase path for resilience/preview continuity.
- Fallback is host-scoped to avoid controller transport mismatch.
- Protocol version: `2` (shared contracts + client mirror must stay aligned).

## Runtime Room Features (Current)
- Room create endpoint issues host token; host token verified on join.
- Lobby/start gates use active seats (spectators excluded).
- Room policy support: `open | approval | locked`.
- Mid-game admission queue with host resolution (spectator/transfer/spawn).
- Bot management: add/remove/replace/autofill.
- Lifecycle path: `lobby -> playing -> finished -> lobby`.

## Reliability Surfaces
- Connection states exposed in UI (`connecting`, `syncing`, `reconnecting`, ready).
- Error diagnostics surfaced in room UI (transport, retries, last error code).
- Join-time timeout handling for Colyseus handshake.
- PWA update prompt path for stale client bundles.

## Non-Goals in Current Pass
- No Coolify migration/reset work.
- No Supabase schema reset/migration changes.
- No voice/AI expansion beyond current scaffolding.
