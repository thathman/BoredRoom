# Codex Handoff — BoredRoom

Last updated: 2026-06-26 12:38 WAT

## Mission

BoredRoom must become a production-ready Nigerian party-game platform:

`Create once → join once → play all night → choose installed game → devices switch in place → recap → next game`

The current product/source of truth is in `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/` and the goal objective file at `/Users/hendrix/.codex/attachments/5ce9a566-12f1-4063-bfc2-26da944c4695/goal-objective.md`.

Do not mark the long-running goal complete until every requirement in those files is proven by current evidence.

## Repositories

- Main app: `/Users/hendrix/Playground/boredroom` / `thathman/BoredRoom`
- Games repo: `/Users/hendrix/Playground/BoredRoom-Games` / `thathman/BoredRoom-Games`
- Spec repo: `/Users/hendrix/Playground/BoredRoom-Spec` / `thathman/BoredRoom-Spec`
- Original prototype/reference: `thathman/game-night-hub-3e7e5596`

## Required session start

- Run `AI_AGENT=codex ~/ai-spine/scripts/ai-bus read`.
- Read this file and `docs/IMPLEMENTATION_PROGRESS.md`.
- Check the worktree in all repos before assuming prior state.
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
- Latest main-app deployed commit: `7ef98f7 Document implementation audit baseline`.

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
PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs
```

Deploy to Dell:

```bash
cd /Users/hendrix/Playground/boredroom
bash scripts/deploy-dell.sh
```

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

2. Audit failure:
   - `npm --prefix server audit --audit-level=moderate` reports 3 moderate vulnerabilities: `@colyseus/core`, `@colyseus/ws-transport`, `nanoid`.

3. Games repo version mismatch:
   - `catalog.json` and `dist/*.tgz` are `1.2.0.0`.
   - Source manifests are `1.0.0.0`.

4. Signing material:
   - `.signing/private.pem` exists locally in BoredRoom-Games. Do not print it. Check whether tracked; move secrets out of repo tree if necessary.

5. Vote lifecycle incomplete:
   - Existing vote implementation is simple open/cast tally. Spec wants a proper vote lifecycle with requests/support/pass/fail/expired timers and persistence.

6. Companion control incomplete:
   - Companion pairing exists. Full producer/control-booth flow is not complete.

7. Party lifecycle incomplete:
   - Current statuses do not match the goal objective’s party lifecycle vocabulary.

8. Visual regression incomplete:
   - No screenshot comparison ledger or native-size fixture gate.

9. Recovery incomplete:
   - No server-restart recovery E2E proving persisted snapshot restore.

10. Admin dashboard incomplete:
   - `/games` covers library/admin install state, but there is no full server back-office for logs, active parties, health, moderation, and AI.

## Exact remaining tasks

### Immediate next tasks

1. Fix server dependency audit or document exact non-fixable advisory status with evidence.
2. Keep AI model health and fallback tests passing after dependency changes.
3. Update both docs after each change.
4. Commit/push/deploy and rerun live smoke/matrix.

### Short-term production tasks

- Implement full vote lifecycle.
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
- live full 15-game matrix passes
- recovery E2E passes
- QR camera evidence collected
- docs updated
- all changes pushed with correct author

## Current next recommended prompt

“Continue from the BoredRoom handoff docs. Fix the server audit vulnerabilities or document exact non-fixable advisory status with evidence. Keep docs updated, run full gates, deploy to Dell, and verify live entry/bot/gameplay matrix.”

Latest live evidence after `7ef98f7` deploy:

- `curl -fsS https://colyseus.hendrix.com.ng/healthz` passed.
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs` passed.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-bot-autofill.mjs` passed with bot seated in `FS5W`.
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs` passed 15 games through `FMNM`.
