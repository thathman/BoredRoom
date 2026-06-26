# Codex Handoff — BoredRoom

Last updated: 2026-06-26 22:05 WAT

> **DeepSeek V4 Pro continuation (2026-06-26 16:53 WAT):** I'm the current LLM handling this build. Codex started the vote lifecycle, Claude continued through rounds 2–3, party-status migration, admin dashboard, profiles/avatars, PWA/QR, and End/Delete Party. Profiles/avatars and PWA/QR are not yet deployed to Dell. The active goal is now GOAL2.md — the full game-layer rebuild across all 15 games.

> **Codex continuation (2026-06-26 20:25 WAT):** User corrected the game-layer strategy: do not invent Monopoly/Oga Landlord or other standard game logic from scratch when forkable open-source implementations exist. `GOAL1.md` and `GOAL2.md` are the split local objectives. Current worktrees are not clean; inspect all three repos before editing or staging.

> **Codex continuation (2026-06-26 21:00 WAT):** User supplied stronger external sources. Use `itaylayzer/Monopoly` as the primary Oga Landlord source, `mykeels/whot` + `mykeels/whot-server` for Whot, `joshzcold/Friendly-Feud` for Faith Feud, and `joshtom/connect-four-game` as the user-preferred Connect 4 reference. Licenses found: MIT for Monopoly/Whot/Friendly-Feud; Connect 4 declares ISC in `package.json` but no standalone LICENSE file was detected, so preserve explicit attribution before vendoring code.

> **Codex continuation (2026-06-26 22:05 WAT):** User clarified they prefer the feature set in `christelbuchanan/Monopoly-Game` for Oga Landlord and has permission from the author. Use that as the preferred feature target; use `itaylayzer/Monopoly` secondarily for bots/audio/music/React polish. `docs/IMPLEMENTATION_PROGRESS.md` now has a top-level GOAL1/GOAL2 verification snapshot plus a Claude continuation TODO list.

## Mission

BoredRoom must become a production-ready Nigerian party-game platform:

`Create once → join once → play all night → choose installed game → devices switch in place → recap → next game`

The current product/source of truth is in `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/`, `/Users/hendrix/Playground/GOAL1.md`, and `/Users/hendrix/Playground/GOAL2.md`.

Do not mark the long-running goal complete until every requirement in those files is proven by current evidence.

## Repositories

- Main app: `/Users/hendrix/Playground/boredroom` / `thathman/BoredRoom`
- Games repo: `/Users/hendrix/Playground/BoredRoom-Games` / `thathman/BoredRoom-Games`
- Spec repo: `/Users/hendrix/Playground/BoredRoom-Spec` / `thathman/BoredRoom-Spec`
- Original prototype/reference: `thathman/game-night-hub-3e7e5596`

## Required session start

- Read this file (`docs/CODEX_HANDOFF.md`) first, then `docs/IMPLEMENTATION_PROGRESS.md`.
- Check the worktree in all repos before assuming prior state.
- Add your own continuation marker to both docs when you pick up the build — keep the lineage visible: `AgentName (timestamp): what you found and what you did`.
- Commit as `Hendrix Nwaokolo <n.hendrix.e@gmail.com>` with no AI/tool attribution.

## Current architecture summary

### Main app

- React/Vite frontend with routes in `src/App.tsx`.
- Colyseus server in `server/src/index.ts`.
- Single realtime room: `HouseSessionRoom` in `server/src/rooms/HouseSessionRoom.ts`.
- Session memory/persistence model: `server/src/sessionDirectory.ts`, `server/src/foundations.ts`.
- Installed game loader: `server/src/installedGames.ts`.
- Shared contracts: `shared/src/contracts/`.
- Device flow: `src/lib/deviceExperience.ts`, `src/pages/Index.tsx`, `src/pages/SessionJoin.tsx`, `src/pages/SessionScreen.tsx`.
- Game display/controller surface in current main app: `src/components/session/InstalledGameSurface.tsx`.
- AI orchestration: `server/src/aiService.ts`.
- Deterministic bot strategy: `server/src/botStrategy.ts`.
- Latest main-app deployed commit: `d3d196b Add server-backed vote lifecycle state`.

### Runtime flow

- Host creates session via `POST /sessions`.
- Devices join `house-session` with role: `display`, `controller`, `crowd`, or `companion`.
- Host selects/starts installed game through `session:start_game` or `session:select_game`.
- `HouseSessionRoom` creates an installed `GameRuntime`, seats ready connected controllers, and sends role-specific projections.
- Controllers send `game:intent`; runtime validates through `handleIntent`.
- Runtime exposes legal intents for hints and deterministic bots.
- Snapshots are stored in-memory and persisted when Supabase service-role config is present.

### Games repo

- `catalog.json` points to 15 release artifacts at `1.2.0.0`.
- Each `games/<id>/manifest.json` currently says `1.0.0.0`, which is a mismatch.
- `scripts/build-catalog.mjs` builds artifacts/catalog.
- `scripts/runtime-contract.test.mjs` performs current runtime contract checks.

## How to run locally

Main app:

```bash
cd /Users/hendrix/Playground/boredroom
npm install
npm run dev
```

Server:

```bash
cd /Users/hendrix/Playground/boredroom/server
npm install
npm run dev
```

Production-style build gates:

```bash
cd /Users/hendrix/Playground/boredroom
npm run typecheck
npm run lint
npm test -- --run
npm run build
npm --prefix server run build
```

Live smoke after deploy:

```bash
cd /Users/hendrix/Playground/boredroom
curl -fsS https://colyseus.hendrix.com.ng/healthz
PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs
BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-bot-autofill.mjs
BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-vote-lifecycle.mjs
PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs
```

Deploy to Dell:

```bash
cd /Users/hendrix/Playground/boredroom
bash scripts/deploy-dell.sh
```

Deployment note:

- `scripts/deploy-dell.sh` now groups optional container removal separately from `docker compose build`, so a failed image build stops the deployment.
- Health checks retry quietly for 60 seconds and print compose status/server logs before failing non-zero.
- Validation run this pass: `bash -n scripts/deploy-dell.sh`, `DRY_RUN=1 bash scripts/deploy-dell.sh`, and a real `bash scripts/deploy-dell.sh` Dell deploy with successful web/server build, restart, and `/healthz` check.

Games repo:

```bash
cd /Users/hendrix/Playground/BoredRoom-Games
npm test
npm run build
```

## Important decisions already made

- Keep `HouseSessionRoom` as the only realtime room.
- Do not introduce per-game room codes or game-specific routes.
- Server remains authoritative for gameplay and legal intents.
- AI returns typed structured outputs and fails soft.
- Bots act through legal intents only.
- Device role restrictions are enforced in navigation and session admission.
- `/packs` remains only a redirect to `/games`.
- Pack terminology should not be reintroduced.

## Current known bugs and mismatches

1. AI model pin:
   - Spec says `google/gemini-2.5-flash-lite`.
   - Code now defaults to `google/gemini-2.5-flash-lite` and remains overrideable with `AI_MODEL`.

2. Dependency audit / Colyseus alignment:
   - Server npm audit now passes after upgrading Colyseus server packages.
   - Client was migrated from `colyseus.js` to `@colyseus/sdk` to match the 0.17 server line.
   - Root/server zod dependencies are aligned so Docker `npm ci` succeeds.
   - Live health, entry flow, bot autofill, and 15-game matrix passed after deployment.

3. Games repo version mismatch:
   - `catalog.json` and `dist/*.tgz` are `1.2.0.0`.
   - Source manifests are `1.0.0.0`.

4. Signing material:
   - `.signing/private.pem` exists locally in BoredRoom-Games. Do not print it. Check whether tracked; move secrets out of repo tree if necessary.

5. Vote lifecycle — round 2 done (`1.4.0.0`, not yet deployed):
   - Added `vote:override` (host) and `vote:request` (player) server messages, `allowPlayerVotes` party setting + cooldown/overlap guards, and `maybeAutoApply` (auto-apply+archive when `settings.autoApply` and an outright winner).
   - `useHouseSession` exposes `requestVote`/`closeVote`/`cancelVote`/`applyVoteResult`/`overrideVote`. Companion vote control-booth panel + controller "Call a house vote" button added.
   - Round 3 (no version bump): resolved `game_selection` votes now start the winning installed game server-side (`findInstalledGameId` + `applyVoteSideEffects`); companion vote-history view added; `scripts/playwright-vote-lifecycle.mjs` now also covers player-requested votes and host override (passes against a local built server).
   - Still missing: admin dashboard vote visibility, real-browser (Playwright page) vote UI smoke, recap mention of major votes. Deploy to Dell and rerun live smoke.

6. Companion control incomplete:
   - Companion pairing exists. Full producer/control-booth flow is not complete.

7. Party lifecycle:
   - Explicit End Party / Delete Party landed: `endSession`/`deleteSession` in sessionDirectory, `session:end_party`/`session:delete_party` room messages (delete requires the house code echoed back), `endParty`/`deleteParty` hook methods, companion danger panel, and an ended/deleted screen for all devices. Enum gained `ending_confirm`/`deleted`.
   - Still legacy: in-game status vocabulary (`game_active`, `next_decision`, `walkthrough`, `voting`) hasn't been renamed to the spec's `in_game`/`selecting_game`/`configuring_game`/`intermission`. That rename is a larger migration touching server + frontend; do it as a dedicated pass.

8. Visual regression incomplete:
   - No screenshot comparison ledger or native-size fixture gate.

9. Recovery incomplete:
   - No server-restart recovery E2E proving persisted snapshot restore.

10. Admin dashboard incomplete:
   - `/games` covers library/admin install state, but there is no full server back-office for logs, active parties, health, moderation, and AI.

## Exact remaining tasks

### Immediate next tasks

1. Vote + party lifecycle are now broad: companion UI, player requests, auto-apply, game-selection start-from-vote, action votes (end_party/end_game/pause/resume), public-display vote overlay, recap vote mentions, and explicit End/Delete Party. Remaining vote/party work: admin dashboard vote/session visibility, vote-driven admit/kick/remote_mode/team_change, browser-page (not just socket) vote UI smoke, and the in-game **party-status vocabulary migration** (`game_active`→`in_game`, `next_decision`→`intermission`, `voting`→`selecting_game`, add `configuring_game`/`game_recap`). Deploy to Dell and rerun live smoke. Next biggest non-vote tracks: admin dashboard, profiles/avatars, PWA/QR hardening, and the per-game rebuilds (Whot/Ludo/Connect4/etc.).
2. Keep `scripts/playwright-vote-lifecycle.mjs` in the live smoke set when changing votes/session messages.
3. Update both docs after each change.
4. Commit/push/deploy and rerun live smoke/matrix.

### Short-term production tasks

- Finish full vote lifecycle beyond the first server-state slice.
- Move heavy host controls into companion; keep public display as stage.
- Add explicit party ending lifecycle separate from game ending.
- Add route/device correction E2E.
- Add QR camera permission/device test plan and manual evidence.
- Add refresh/reconnect/server restart recovery E2E.
- Add visual regression fixtures/ledger.
- Align BoredRoom-Games manifests/catalog/artifacts and remove/move signing private key.
- Add artifact rejection tests: digest, signature, MIME, traversal, oversized archive.
- Strengthen runtime contract tests for all 15 games.
- Add admin dashboard scope.

## Release checklist

Before claiming completion:

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `npm --prefix server run build`
- `npm --prefix server audit --audit-level=moderate`
- BoredRoom-Games `npm test`
- BoredRoom-Games `npm run build`
- visual regression ledger passes
- live Dell health passes
- live entry flow passes
- live bot autofill passes
- live vote lifecycle smoke passes
- live full 15-game matrix passes
- recovery E2E passes
- QR camera evidence collected
- docs updated
- all changes pushed with correct author

## Current next recommended prompt

“Continue from `/Users/hendrix/Playground/boredroom/docs/IMPLEMENTATION_PROGRESS.md`, especially the top GOAL1/GOAL2 verification snapshot and Claude TODO list. Prioritize Oga Landlord using `christelbuchanan/Monopoly-Game` as the preferred feature source with stated author permission, then source-guided Whot/Faith Feud/Connect 4. Keep all gameplay server-authoritative through `GameRuntime`; run gates and update docs.”

Latest live evidence after `d3d196b` deploy:

- `curl -fsS https://colyseus.hendrix.com.ng/healthz` passed.
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs` passed.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-vote-lifecycle.mjs` passed with vote `vote_mqv0okiih5n6lx` through `EYSF`.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-bot-autofill.mjs` passed with bot seated in `XNG6`.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs` passed 15 games through `CN76`.
- Final live homepage visual screenshot with visible skyline, twinkle stars, shooting stars, and pointer glow/trails: `/tmp/boredroom-live-home-final.png`.
