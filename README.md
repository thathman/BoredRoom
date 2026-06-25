# BoredRoom

Browser-based **same-room** multiplayer party games. Create one house session, let players
join once, and switch games without changing routes, controllers, or public codes.

Built for Naija game nights: Ludo, Whot, Who Sabi Pass? trivia, Oga Landlord, Hustle,
Word Wahala, Color Wahala and more — with English and Pidgin (pcm) language support.

## Stack

- **Web app** — Vite + React + TypeScript + Tailwind/shadcn (PWA)
- **Realtime server** — [Colyseus](https://colyseus.io) authoritative game server (`server/`)
- **Shared package** — deterministic rules engines + transport contracts (`shared/`)
- **Supabase** — auxiliary auth, match history, and replay storage
- **AI** — optional commentary/recap via an OpenAI-compatible endpoint (OpenRouter)

## Quick start

```bash
# 1. install deps
npm install
npm --prefix server install

# 2. configure env
cp .env.example .env   # fill in your Supabase + Colyseus values

# 3. run
npm run dev            # web app on http://localhost:8080
npm --prefix server run dev   # realtime server on :2567
```

## Configuration

Copy `.env.example` to `.env` and set:

| Var | Purpose |
| --- | --- |
| `VITE_SUPABASE_URL` / `VITE_SUPABASE_PUBLISHABLE_KEY` / `VITE_SUPABASE_PROJECT_ID` | Supabase project (publishable/anon key — safe for frontend) |
| `VITE_COLYSEUS_URL` | WebSocket URL of the realtime server (e.g. `wss://colyseus.example.com`) |
| `SUPABASE_SERVICE_ROLE_KEY` | Server-only key used for session, run, device, and pack persistence |
| `PACK_ADMIN_TOKEN` | Server-only credential required for pack installation/removal |
| `VITE_LOGO_DEV_TOKEN` | [logo.dev](https://logo.dev) publishable token for Logo Guesser |

AI features (edge functions) use an OpenAI-compatible endpoint — set `OPENROUTER_API_KEY`
and optionally `AI_MODEL` as Supabase secrets.

## Testing

```bash
npm run test            # unit tests (vitest)
npm run smoke:all       # full live smoke suite (starts server + runs matrix)
npm run verify          # lint, typecheck, tests, and production build
```

## Deployment

Docker Compose builds the web (`boredroom-web`) and server (`boredroom-server`) images:

```bash
docker compose up -d --build
```

## Product flow

`Create session → players join once → choose a game → play → recap → choose the next game`

Public routes are `/`, `/start`, `/join`, and `/session/:code/{display|controller|crowd|companion}`.
The display owns concealed host controls; companion control is optional and uses a short-lived
pairing code.
