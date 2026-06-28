# BoredRoom

<p align="center">
  <strong>A Nigerian party-game operating system for one-room and remote game nights.</strong>
</p>

<p align="center">
  <a href="https://github.com/thathman/BoredRoom"><img alt="Repo" src="https://img.shields.io/badge/repo-BoredRoom-7c3aed?style=for-the-badge&logo=github"></a>
  <a href="https://github.com/thathman/BoredRoom-Games"><img alt="Games" src="https://img.shields.io/badge/games-installable%20catalog-22c55e?style=for-the-badge&logo=github"></a>
  <a href="./LICENSE.md"><img alt="License" src="https://img.shields.io/badge/license-MIT-blue?style=for-the-badge"></a>
  <img alt="Version" src="https://img.shields.io/badge/version-1.8.0.0-f97316?style=for-the-badge">
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

BoredRoom is a browser-based multiplayer party-game platform built around one idea:

> **Create one party. Let everyone join once. Play all night.**

It is designed for Nigerian/Naija game nights where a TV, laptop, or projector acts as the public display and each player uses their phone as a controller. A host creates a single house session, invites players with a four-character code or QR link, picks games, plays, recaps, and moves to the next game without making players rejoin.

BoredRoom is not just a game collection. It is a game-night operating system with:

- public display mode;
- private player controllers;
- optional companion host control;
- installable signed game artifacts;
- server-authoritative gameplay;
- reconnect and restore support;
- AI-assisted commentary, hints, recommendations, and recaps where configured;
- Naija-flavoured party games.

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
| Public display | TV, laptop, projector, desktop browser | The stage. Shows code, QR, game board, questions, timers, votes, and recaps. |
| Controller | Player phone | The player's hand. Shows private cards, dice, choices, text/voice inputs, legal moves, and reactions. |
| Companion | Host phone/tablet | The producer booth. Runs host controls, player management, game settings, votes, timers, and recaps. |
| Crowd | Spectator device | Watches, reacts, and votes only where allowed. |
| Admin dashboard | Owner/admin browser | Back office for installed games, active parties, health, logs, AI status, and game data tools. |

---

## Current game family

BoredRoom supports installable games from [`BoredRoom-Games`](https://github.com/thathman/BoredRoom-Games).

| Game | Type | Notes |
| --- | --- | --- |
| Bible Timeline Rush | Ordering / speed | Arrange Bible events in timeline order. |
| Color Wahala | Stroop / reaction | Read the instruction, ignore the distraction, tap fast. |
| Connect 4 | Board / team | Public board, controller columns, solo/team play. |
| Endless Tic Tac Toe | Board / memory | Rolling tic-tac-toe with limited active marks. |
| Faith Feud | Survey / team | Faith-friendly Family Feud-style game. |
| Half & Half | Social prediction | Split-vote and midpoint prediction. |
| Hustle | Board / dice | Snakes-and-Ladders-style Naija hustle board. |
| Oga Landlord | Property / board | Monopoly-inspired Nigerian property game. |
| Logo Guesser | Recognition | Obscured logo/brand guessing. |
| Ludo | Board / dice | Classic race-home Ludo. |
| Market Price | Estimation | Guess Nigerian product prices from cached snapshots. |
| Pidgin Translator | Voice/text speed | Translate fast between English and Pidgin. |
| Who Sabi Pass? | Trivia | Nigerian culture, history, music, film, and general knowledge. |
| Whot | Card game | Nigerian shape-and-number showdown. |
| Word Wahala | Word board | Scrabble-like word-board game. |

Games are installed as signed artifacts. A fresh deployment can start with an empty game library and install only the games the owner wants.

---

## Architecture

| Layer | Technology |
| --- | --- |
| Web app | Vite, React, TypeScript, Tailwind CSS, shadcn/Radix UI |
| Realtime server | Colyseus, Express, TypeScript |
| Client transport | `@colyseus/sdk` |
| State/contracts | Shared TypeScript contracts and zod validation |
| PWA | Vite PWA, Workbox, manifest icons, install/fullscreen support |
| QR | `qrcode.react`, ZXing browser scanner |
| Animation/3D support | Three.js, React Three Fiber, Framer Motion |
| Persistence | Supabase service-role access on the server side |
| AI | DeepSeek structured-output API, server-side only |
| Deployment | Docker Compose web + realtime server services |

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
└── .env.example             # Environment template
```

---

## Quick start

```bash
git clone https://github.com/thathman/BoredRoom.git
cd BoredRoom

npm install
npm --prefix server install
cp .env.example .env
```

Run the web app:

```bash
npm run dev
```

Run the realtime server:

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

| Variable | Scope | Required | Purpose |
| --- | --- | --- | --- |
| `VITE_COLYSEUS_URL` | Frontend | Yes | WebSocket URL for the realtime server. |
| `SUPABASE_URL` | Server | Optional | Supabase URL for persistence. |
| `SUPABASE_SERVICE_ROLE_KEY` | Server only | Optional | Server-only key for session persistence. Never expose to frontend. |
| `GAME_ADMIN_TOKEN` | Server only | Recommended | Long random token for admin/game management actions. |
| `GAME_ADMIN_ORIGINS` | Server only | Recommended | Allowed origins for admin endpoints. |
| `DEEPSEEK_API_KEY` | Server only | Optional | Enables AI commentary, private hints, recaps, and recommendations. |
| `DEEPSEEK_MODEL` | Server only | Optional | DeepSeek model; defaults to `deepseek-v4-flash`. |
| `DEEPSEEK_BASE_URL` | Server only | Optional | DeepSeek API base URL. |
| `TTS_API_KEY` | Server only | Optional | Enables YarnGPT Whot callouts and winner announcements. |
| `TTS_VOICES` | Server only | Optional | Comma-separated YarnGPT voices used deterministically for variety. |
| `BOREDROOM_GAMES_DIR` | Server only | Deployment | Directory for installed game artifacts. |
| `BOREDROOM_GAMES_CATALOG_URL` | Server only | Deployment | Official game catalog URL. |
| `BOREDROOM_GAMES_PUBLIC_KEY` | Server only | Deployment | Public key used to verify signed game artifacts. |

Only `VITE_` variables may be exposed to the browser. Service-role keys, admin tokens, signing keys, and AI keys must remain server-side.

---

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` | Run Vite dev server. |
| `npm run build` | Build production web app. |
| `npm run lint` | Run ESLint. |
| `npm run typecheck` | Run TypeScript check. |
| `npm run test` | Run Vitest tests. |
| `npm run verify` | Run lint, typecheck, tests, and production build. |
| `npm run gates:release` | Run release gates including audit and server build checks. |
| `npm run smoke:ui-entry` | Playwright entry-flow smoke tests. |
| `npm run smoke:votes` | Vote lifecycle smoke tests. |
| `npm run smoke:host-controls` | Host-control smoke tests. |
| `npm run smoke:gameplay` | Game matrix smoke tests. |
| `npm run smoke:e2e` | Unified session smoke test. |
| `npm --prefix server run dev` | Run realtime server in watch mode. |
| `npm --prefix server run build` | Build server TypeScript. |
| `npm --prefix server run start` | Start built server. |

---

## Testing and release gates

Before meaningful merges or deployment, run:

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
- reconnect and restore;
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

```bash
docker compose up -d --build
```

Docker Compose builds:

| Service | Container | Purpose |
| --- | --- | --- |
| `web` | `boredroom-web` | Static web/PWA app. |
| `server` | `boredroom-server` | Colyseus realtime server. |

Default mapped ports:

| Host port | Service |
| --- | --- |
| `8088` | Web app |
| `2567` | Realtime server |

The server uses a persistent Docker volume for installed games:

```text
boredroom-games:/var/lib/boredroom/games
```

---

## Game installation model

BoredRoom installs games from a signed catalog in the separate [`BoredRoom-Games`](https://github.com/thathman/BoredRoom-Games) repository.

The server should verify catalog source, artifact URL, artifact digest, artifact signature, archive path safety, runtime contract, and game version pinning.

Fresh deployments may start with no installed games. Games should be installed intentionally by the owner/admin, and active game runs should remain pinned to the exact installed version used when the run started.

---

## AI behavior

AI features are optional. Gameplay must remain available if AI is disabled, unavailable, out of credit, rate-limited, or slow.

AI may help with commentary, game recommendations, private hints, rules explanations, recaps, generated question/survey content, and deterministic bot ranking from legal intents.

AI must not invent illegal moves, apply moves directly, see private state it is not allowed to see, block gameplay if it fails, or expose API keys to the frontend.

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

For voice games: use push-to-talk or short intentional capture, do not stream room audio, do not broadcast raw audio, provide text fallback, and delete temporary audio after transcription/scoring where server transcription is used.

---

## PWA notes

BoredRoom is designed as a PWA so controllers can feel closer to a native party-game controller.

PWA implementation should support install prompts where available, Add to Home Screen guidance where needed, standalone/fullscreen display modes, safe-area handling, wake lock where supported, and reconnect UX when phone lock/backgrounding interrupts connection.

---

## Security

See [`SECURITY.md`](./SECURITY.md).

High-level rules:

- keep service-role keys server-side;
- keep AI keys server-side;
- protect admin endpoints;
- validate realtime payloads;
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

This repository uses the MIT license notice in [`LICENSE.md`](./LICENSE.md).

Third-party assets, trademarks, logos, product data, product images, brand names, and referenced services are not relicensed by this repository.
