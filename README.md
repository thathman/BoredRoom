# BoredRoom

<p align="center">
  <strong>A Nigerian party-game operating system for one-room and remote game nights.</strong>
</p>

<p align="center">
  <a href="https://github.com/thathman/BoredRoom"><img alt="Repo" src="https://img.shields.io/badge/repo-BoredRoom-7c3aed?style=for-the-badge&logo=github"></a>
  <a href="https://github.com/thathman/BoredRoom-Games"><img alt="Games" src="https://img.shields.io/badge/games-installable%20catalog-22c55e?style=for-the-badge&logo=github"></a>
  <a href="./LICENSE"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.6.0.0-f97316?style=for-the-badge">
</p>

<p align="center">
  <a href="#quick-start">Quick start</a> •
  <a href="#product-flow">Product flow</a> •
  <a href="#architecture">Architecture</a> •
  <a href="#configuration">Configuration</a> •
  <a href="#testing-and-release-gates">Testing</a> •
  <a href="#security">Security</a>
</p>

---

## What is BoredRoom?

BoredRoom is a browser-based multiplayer party-game platform built around one simple idea:

> **Create one party. Let everyone join once. Play all night.**

It is designed for Nigerian/Naija game nights where a TV, laptop, or projector acts as the public display and each player uses their phone as a controller. A host can create a single house session, invite players with a four-character code or QR link, pick games, play, recap, and move to the next game without creating a new room or making players rejoin.

BoredRoom is not just a collection of games. It is a game-night operating system with:

- a public display for the room;
- private player controllers;
- optional companion host control;
- installable signed game artifacts;
- server-authoritative gameplay;
- reconnect and restore support;
- AI-assisted commentary, hints, recommendations, and recaps where configured;
- a growing catalog of Naija-flavoured party games.

---

## Product flow

```text
Create party → players join once → lobby → choose game → configure game → play → recap → choose next game
```

A **party** is the full game night. A **game** is one activity inside the party. A **round** or **turn** is one unit inside a game.

Ending a game should not end the party. Ending the party is a separate explicit host action.

---

## Roles

| Role | Typical device | Purpose |
| --- | --- | --- |
| Public display | TV, laptop, projector, desktop browser | The stage. Shows the room code, QR, game board, questions, timers, vote overlays, and recaps. |
| Controller | Player phone | The player's hand. Shows private cards, dice, choices, text/voice inputs, legal moves, and reactions. |
| Companion | Host phone or tablet | The producer booth. Runs party controls, player management, game configuration, votes, timers, and recap controls. |
| Crowd | Spectator device | Watches, reacts, and votes only where allowed. |
| Admin dashboard | Owner/admin browser | Server back office for installed games, active parties, health, logs, AI status, and game data tools. |

---

## Current game family

BoredRoom supports installable games from the official [`BoredRoom-Games`](https://github.com/thathman/BoredRoom-Games) catalog.

The current catalog includes:

| Game | Type | Notes |
| --- | --- | --- |
| Bible Timeline Rush | Ordering / speed | Arrange Bible events in the correct timeline. |
| Color Wahala | Stroop / reaction | Read the instruction, ignore the distraction, tap fast. |
| Connect 4 | Board / team | Public board, controller columns, solo or team play. |
| Endless Tic Tac Toe | Board / memory | Rolling tic-tac-toe with limited active marks. |
| Faith Feud | Survey / team | Faith-friendly Family Feud-style game. |
| Half & Half | Social prediction | Split-vote and midpoint prediction rounds. |
| Hustle | Board / dice | Snakes-and-Ladders-style Naija hustle board. |
| Oga Landlord | Property / board | Monopoly-inspired Nigerian property game. |
| Logo Guesser | Recognition | Obscured logo/brand guessing. |
| Ludo | Board / dice | Classic race-home board game. |
| Market Price | Estimation | Guess Nigerian grocery/product prices from cached snapshots. |
| Pidgin Translator | Voice/text speed | Translate fast between English and Pidgin. |
| Who Sabi Pass? | Trivia | Nigerian culture, history, music, film, and general knowledge. |
| Whot | Card game | Nigerian shape-and-number showdown. |
| Word Wahala | Word board | Scrabble-like word-board game. |

Games are installed as signed artifacts. A fresh BoredRoom deployment can start with an empty game library and then install games from the catalog.

---

## Stack

| Layer | Technology |
| --- | --- |
| Web app | Vite, React, TypeScript, Tailwind CSS, shadcn/Radix UI |
| Realtime server | Colyseus, Express, TypeScript |
| Client transport | `@colyseus/sdk` |
| State/contracts | Shared TypeScript contracts and zod validation |
| PWA | Vite PWA, Workbox, manifest icons, install/fullscreen support |
| QR | `qrcode.react`, ZXing browser scanner |
| 3D/animation support | Three.js, React Three Fiber, Framer Motion |
| Persistence | Supabase service-role access on the server side |
| AI | OpenRouter/OpenAI-compatible endpoint, server-side only |
| Deployment | Docker Compose web + realtime server services |

---

## Repository layout

```text
BoredRoom/
├── src/                     # React app: routes, display/controller/companion UI
├── server/                  # Colyseus authoritative realtime server
├── shared/                  # Shared contracts, schemas, deterministic helpers
├── scripts/                 # Smoke tests, Playwright flows, release checks
├── public/                  # Static assets, PWA files, icons
├── supabase/                # Supabase functions/config if present
├── docs/                    # Implementation notes, handoff docs, specs
├── docker-compose.yml       # Production-style web + server deployment
├── Dockerfile               # Web image
├── package.json             # Frontend scripts and dependencies
└── .env.example             # Local/deploy environment template
```

---

## Quick start

### 1. Clone and install

```bash
git clone https://github.com/thathman/BoredRoom.git
cd BoredRoom

npm install
npm --prefix server install
```

### 2. Configure environment

```bash
cp .env.example .env
```

Fill in the values described in [Configuration](#configuration).

### 3. Run the web app and realtime server

In one terminal:

```bash
npm run dev
```

In another terminal:

```bash
npm --prefix server run dev
```

Default local URLs:

| Service | URL |
| --- | --- |
| Web app | `http://localhost:8080` |
| Colyseus server | `ws://localhost:2567` |

---

## Configuration

Copy `.env.example` to `.env` and configure the values below.

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_COLYSEUS_URL` | Frontend | Yes | WebSocket URL for the realtime server. Example: `ws://localhost:2567`. |
| `SUPABASE_URL` | Server | Optional but recommended | Supabase project URL for persistence. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional but recommended | Server-only service-role key for HouseSession persistence. Never expose to frontend. |
| `GAME_ADMIN_TOKEN` | Server only | Recommended | Long random token for admin/game management actions. |
| `GAME_ADMIN_ORIGINS` | Server only | Recommended | Allowed origins for admin endpoints. |
| `OPENROUTER_API_KEY` | Server only | Optional | Enables AI commentary, hints, recaps, and recommendations. |
| `AI_MODEL` | Server only | Optional | OpenRouter/OpenAI-compatible model name. |
| `AI_APP_URL` | Server only | Optional | App URL sent to AI provider metadata where used. |
| `AI_APP_NAME` | Server only | Optional | App name sent to AI provider metadata where used. |
| `BOREDROOM_GAMES_DIR` | Server only | Deployment | Directory for installed game artifacts. |
| `BOREDROOM_GAMES_CATALOG_URL` | Server only | Deployment | Official game catalog URL. |
| `BOREDROOM_GAMES_PUBLIC_KEY` | Server only | Deployment | Public key used to verify signed game artifacts. |

Security rule: only variables prefixed with `VITE_` may be exposed to the browser. Service-role keys, admin tokens, signing keys, and AI keys must remain server-side.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Vite dev server. |
| `npm run build` | Build production web app. |
| `npm run build:dev` | Build in development mode. |
| `npm run preview` | Preview built app locally. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript check for the app. |
| `npm run test` | Run Vitest tests. |
| `npm run test:watch` | Run Vitest in watch mode. |
| `npm run verify` | Run lint, typecheck, tests, and production build. |
| `npm run gates:release` | Run release gates including audit and server build checks. |
| `npm run smoke:server-start` | Smoke test server startup. |
| `npm run smoke:e2e` | Smoke test unified session flow. |
| `npm run smoke:ui-entry` | Playwright entry-flow smoke tests. |
| `npm run smoke:votes` | Playwright vote lifecycle smoke tests. |
| `npm run smoke:host-controls` | Playwright host-control smoke tests. |
| `npm run smoke:gameplay` | Playwright game matrix smoke tests. |
| `npm run smoke:all` | Server startup plus unified session smoke suite. |
| `npm --prefix server run dev` | Run realtime server in watch mode. |
| `npm --prefix server run build` | Build server TypeScript. |
| `npm --prefix server run start` | Start built server. |

---

## Testing and release gates

Before merging or deploying meaningful changes, run:

```bash
npm run verify
npm run smoke:ui-entry
npm run smoke:gameplay
npm run smoke:e2e
npm run smoke:votes
npm run smoke:host-controls
npm --prefix server run build
```

For release hardening:

```bash
npm run gates:release
```

Important test areas:

- party creation and join flow;
- QR/manual code join;
- public display/controller/companion routing;
- player reconnect and restore;
- vote lifecycle;
- game selection and configuration;
- game runtime legal intents;
- private/public projection isolation;
- timers and late submissions;
- recap and next-game flow;
- PWA install/offline/reconnect behavior;
- admin and game installation security.

---

## Deployment with Docker Compose

Docker Compose builds two services:

| Service | Container | Purpose |
| --- | --- | --- |
| `web` | `boredroom-web` | Static web/PWA app served by the web image. |
| `server` | `boredroom-server` | Colyseus realtime server. |

Start:

```bash
docker compose up -d --build
```

The default compose file maps:

| Host port | Service |
| --- | --- |
| `8088` | Web app |
| `2567` | Realtime server |

The server uses a persistent Docker volume for installed game artifacts:

```text
boredroom-games:/var/lib/boredroom/games
```

If Supabase is deployed in the same Docker environment, the compose file expects an external network named `supabase_default`.

---

## Game installation model

BoredRoom installs games from a signed catalog. The official catalog lives in the separate [`BoredRoom-Games`](https://github.com/thathman/BoredRoom-Games) repository.

The server should verify:

- catalog source;
- artifact URL allowlist;
- artifact digest;
- artifact signature;
- archive path safety;
- runtime contract;
- game version pinning.

Fresh deployments may start with no installed games. Games should be installed intentionally by the owner/admin, and active game runs should remain pinned to the exact installed version used when the run started.

---

## AI behavior

AI features are optional. Gameplay must remain available if AI is disabled, unavailable, out of credit, rate-limited, or slow.

AI may help with:

- host commentary;
- game recommendations;
- private hints;
- rules explanations;
- recaps;
- generated question/survey content;
- deterministic bot ranking from legal intents.

AI must not:

- invent illegal moves;
- apply moves directly;
- see private state it is not allowed to see;
- block gameplay if it fails;
- expose API keys to the frontend.

---

## Data sources and credits

Some games may use third-party reference data, logos, product details, or generated content.

Examples:

- **Logo Guesser** may use configured logo sources where enabled.
- **Market Price** may use cached product and price snapshots imported from Supermart.ng. Product names, prices, images, and product links must be credited to Supermart.ng on reveal screens where used. Prices change often, so each game round should display the cached verification time.
- **Pidgin Translator** may use browser or server speech recognition where configured, but raw audio must not be broadcast and should not be stored by default.

Third-party marks, logos, product images, product names, and source data remain the property of their respective owners. BoredRoom does not claim affiliation with any third-party service unless explicitly stated.

---

## Privacy and safety principles

BoredRoom is built around role-based projection:

- public display sees public state;
- controller sees only that player’s private state;
- companion sees host-control state;
- crowd sees audience-safe state;
- admin sees server-management state.

Do not place raw secrets, raw audio, hidden answers, private hands, private transcripts, service-role keys, signing keys, or admin tokens in public state.

For voice games:

- use push-to-talk or short intentional capture;
- do not stream room audio;
- do not broadcast raw audio;
- provide text fallback;
- delete temporary audio after transcription/scoring where server transcription is used.

---

## PWA notes

BoredRoom is designed as a PWA so controllers can feel closer to a native party-game controller.

PWA implementation should support:

- install prompt where browser supports it;
- Add to Home Screen guidance where browsers do not expose the install prompt;
- standalone/fullscreen display modes where supported;
- safe-area handling;
- wake lock where supported;
- reconnect UX when phone lock/backgrounding interrupts connection.

---

## Security

See [`SECURITY.md`](./SECURITY.md).

High-level rules:

- keep service-role keys server-side;
- keep AI keys server-side;
- protect admin endpoints with `GAME_ADMIN_TOKEN` or stronger auth;
- validate all realtime payloads;
- verify game artifacts before install;
- do not trust client-side timers or game decisions;
- never expose private player state to public/crowd views.

---

## Contributing

See [`CONTRIBUTING.md`](./CONTRIBUTING.md).

The short version:

1. Keep party/game/round/vote lifecycles separate.
2. Make server rules authoritative.
3. Keep controllers focused.
4. Keep public display cinematic.
5. Keep companion as the host control center.
6. Add tests for every game or lifecycle change.
7. Update docs and handoff notes for major changes.

---

## Code of conduct

See [`CODE_OF_CONDUCT.md`](./CODE_OF_CONDUCT.md).

---

## License

This repository is licensed under the MIT License. See [`LICENSE`](./LICENSE).

Third-party assets, names, logos, product data, and referenced services are not relicensed by this project. See [`NOTICE.md`](./NOTICE.md) for attribution and third-party data notes.
