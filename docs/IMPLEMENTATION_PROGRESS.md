# BoredRoom Implementation Progress

Last updated: 2026-06-26 13:45 WAT

## Current objective

Take BoredRoom from prototype/dev mode to a production-ready Nigerian party-game platform aligned with the current BoredRoom-Spec product contract.

Source of truth read this pass:

- `/Users/hendrix/.codex/attachments/5ce9a566-12f1-4063-bfc2-26da944c4695/goal-objective.md`
- `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/00-product-contract.md`
- `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/01-architecture-and-interfaces.md`
- `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/02-design-contract.md`
- `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/03-ai-security-and-persistence.md`
- `/Users/hendrix/Playground/BoredRoom-Spec/15-current-product/04-acceptance-matrix.md`

## Current repo state

Main app: `/Users/hendrix/Playground/boredroom`

- HEAD: `c833fab Align root zod dependency with SDK peers`
- Live Dell deployment verified after this commit.
- `docs/` did not exist before this pass; this file and `docs/CODEX_HANDOFF.md` are now the baseline handoff docs.

Games repo: `/Users/hendrix/Playground/BoredRoom-Games`

- HEAD: `13b3386`
- Catalog has 15 artifact entries at `1.2.0.0`.
- Source manifests still report `1.0.0.0`, so source/catalog/artifact versions are inconsistent.
- `.signing/private.pem` exists in the local repo tree. Do not print or copy it. Confirm whether it is tracked and move signing material out of the repository if needed.

Spec repo: `/Users/hendrix/Playground/BoredRoom-Spec`

- HEAD: `8456748`
- Current authoritative documents are under `15-current-product/`.

## Completed in prior implementation passes

- Unified route surface exists in `src/App.tsx`: `/`, `/start`, `/games`, `/join`, `/join/:sessionCode`, `/session/:code/:screen`; `/packs` redirects to `/games`.
- `HouseSessionRoom` is the single Colyseus room registered in `server/src/index.ts`.
- Game sessions use one four-character house code; live matrix creates sessions and starts all 15 installed games through the house session.
- Homepage no longer exposes desktop join prompt.
- Device-aware landing exists for desktop, tablet, and mobile.
- Homepage Lagos hero was strengthened with a fully visible Lagos skyline/waterline, explicit twinkle-star flares, shooting stars, and pointer mouse trails. Final live screenshot: `/tmp/boredroom-live-home-final.png`.
- QR scanner component exists and QR parsing accepts `/join/:code` and `/session/:code/:screen` URLs.
- Host lobby shows QR/code and an `Advance to games` button.
- Active game display shows a small QR/code strip for rejoining.
- Wake Lock hook and controller persistence/resume storage exist.
- Host detects disconnected seated controllers and pauses active game; controllers have a pause button.
- Voting smoke exists through `session:call_vote` and `vote:cast`, but vote lifecycle is still minimal.
- Whot/Ludo visual surfaces were improved in the main installed surface.
- Server-side AI now uses structured JSON-schema responses with deterministic fallback and private-state isolation tests.
- Deterministic session bots exist in `HouseSessionRoom`; bots act only through server-generated legal intents.
- Live Dell checks after bot work passed:
  - Cloudflare health: `https://colyseus.hendrix.com.ng/healthz`
  - entry smoke: `scripts/playwright-entry-flows.mjs`
  - bot autofill: `scripts/playwright-bot-autofill.mjs`
- Latest 15-game matrix after Colyseus 0.17/client SDK deployment: `scripts/playwright-gameplay-matrix.mjs` with `PASS 15 games through YHQG`
- OpenRouter model pin now matches the current spec: `google/gemini-2.5-flash-lite`.
- Colyseus server/client are aligned on the 0.17 line: server `@colyseus/core`/`@colyseus/ws-transport`; client `@colyseus/sdk`. Server bootstrap uses `gameServer.listen(PORT)` so Colyseus binds matchmaking routes around the existing Express app without breaking REST request bodies.

## Tests and release gates last run

Local gates passed before deploy:

- `npm run typecheck`
- `npm run lint`
- `npm test -- --run`
- `npm run build`
- `npm --prefix server run build`

Live gates passed after deploy:

- `curl -fsS https://colyseus.hendrix.com.ng/healthz`
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs`
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-bot-autofill.mjs`
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs`

Latest live evidence:

- `curl -fsS https://colyseus.hendrix.com.ng/healthz` returned `{"ok":true,"transport":"colyseus","version":3}`.
- `curl -fsSI https://party.hendrix.com.ng/` returned HTTP 200 with `last-modified: Fri, 26 Jun 2026 12:27:21 GMT`.
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs` passed.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-bot-autofill.mjs` passed with bot seated in `NV7C`.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs` passed all 15 games through `YHQG`.

Release-process hardening:

- `scripts/deploy-dell.sh` no longer lets `docker compose up -d` run after a failed `docker compose build`; the optional container removal is grouped separately.
- Health check now suppresses transient curl noise, retries for 60 seconds, and prints `docker compose ps` plus recent server logs before exiting non-zero on failure.
- Verified locally with `bash -n scripts/deploy-dell.sh` and `DRY_RUN=1 bash scripts/deploy-dell.sh`. Next real Dell deploy should verify the hardened path end-to-end.

## Current acceptance status against `15-current-product/04-acceptance-matrix.md`

| ID | Status | Evidence / gap |
| --- | --- | --- |
| CUR-01 | Partially met | Live matrix proves controllers can join once and start 15 games. Needs consecutive-game browser E2E with refresh/reconnect and no route/code changes. |
| CUR-02 | Mostly met | Source test checks only one `gameServer.define` and no `/rooms` API. Need stronger API-level negative checks in live smoke. |
| CUR-03 | Partially met | `BoredRoom-Games/scripts/runtime-contract.test.mjs` exists, but source manifests are `1.0.0.0` while catalog artifacts are `1.2.0.0`; contract coverage is not enough to prove all original mechanics. |
| CUR-04 | Partially met | Whot leak checks and AI private-state tests exist. Need projection isolation tests for every runtime and websocket role. |
| CUR-05 | Partially met | Game admin auth exists. Need stronger tests for install/update/uninstall auth, origin validation, active-run blocking, expired/altered cookies. |
| CUR-06 | Partially met | Active runs pin installed version. Need persistence integration proving history survives uninstall and restart. |
| CUR-07 | Partially met | AI hint tests prove legal-intent selection. Need rule explanations, recommendations, recaps, and bot ranking tests across role projections. |
| CUR-08 | Partially met | No-key and schema-failure fallbacks are tested. Need rate-limit/credit-exhaustion/timeout live or mocked tests. |
| CUR-09 | Partially met | `playwright-entry-flows.mjs` covers desktop/tablet/mobile entry. Need direct-route correction tests and iPadOS/touchscreen-laptop matrix. |
| CUR-10 | Not met | No visual-regression ledger or native-size screenshot comparison exists. Current UI is closer, but not proven against approved references. |
| CUR-11 | Not met | No server-restart recovery E2E. Refresh/reconnect coverage is narrow and mostly smoke-level. |
| CUR-12 | Partially met | Lint/typecheck/tests/build/frontend audit/server audit pass locally. Live health, entry, bot autofill, and 15-game matrix pass after dependency deployment. PWA/mobile viewport coverage remains incomplete. |

## Known product/spec mismatches

- OpenRouter production model is now aligned with the current spec: default `server/src/aiService.ts` model is `google/gemini-2.5-flash-lite`, still overrideable through `AI_MODEL`.
- The current spec describes companion as optional and older product contract says host controls are a concealed drawer on public display. The goal objective says companion is the primary host control booth and heavy host controls belong there. This needs reconciliation in BoredRoom-Spec or implementation.
- Current `HouseSessionStatus` enum still uses `setup`, `waiting_for_players`, `game_active`, `recap`, etc. Goal objective wants party statuses: `draft`, `open_lobby`, `selecting_game`, `configuring_game`, `in_game`, `game_recap`, `intermission`, `ending_confirm`, `ended`, `deleted`. This is a schema/API migration, not a cosmetic rename.
- Vote lifecycle is currently a simple open/cast tally broadcast in `HouseSessionRoom`. It does not yet implement controller requests, support thresholds, close timers, pass/fail/expired status, or persistence model from the spec.
- Public display still owns significant game selection/control UI. The goal objective says public display is the stage and companion should be the producer/control booth.
- `/games` is owner/admin plus catalog; there is no separate admin dashboard for health/logs/active parties/moderation.
- Game source/catalog mismatch in BoredRoom-Games: source manifests are `1.0.0.0`; catalog/artifacts are `1.2.0.0`.
- Several game source folders still include legacy `*Room.ts` files and `source/server.js` placeholders generated by the catalog builder. This may be okay as source history, but it is not cleanly aligned with “no obsolete rooms” unless those are truly unreferenced.
- `.signing/private.pem` exists locally in BoredRoom-Games. Secret material should not be kept in the repo tree.

## Known implementation gaps by area

### Routes and flow

- Need direct-route compatibility tests for desktop/mobile/tablet role enforcement.
- Need make sure active gameplay never shows the game list; currently hidden behind state, but needs E2E.
- Need explicit party end lifecycle separate from game end.
- Need stronger companion control flow: pair, approve, select/configure game, pause/resume, end game, recap/next.

### PWA, QR, reconnect

- Need real camera permission tests or manual-device verification for QR scanner on Android/iOS.
- Wake Lock is best-effort; need visibilitychange/pagehide/reconnect tests and clearer persistent resume after OS sleep.
- Need server restart recovery test using persisted snapshots.
- Need PWA install/offline shell/update prompt tests.

### Game runtime and games

- Need complete runtime contract tests for every game: seating, legal/illegal intents, snapshot/restore, finish/rematch, private-state isolation.
- Need stronger gameplay assertions for non-board challenge games beyond “answer advances scoring.”
- Need verify all original bespoke game mechanics are preserved after plugin wrapping.
- Need visual polish and screenshot review for Connect 4, ETTT, challenge games, and controller surfaces.

### AI

- Model pin is aligned to current spec.
- Need mocked tests for OpenRouter 402/429/timeout and credit/rate-limit health.
- Need AI health visible in owner/admin surfaces beyond drawer.
- Need AI rule explanations, recommendations, recaps, moderation, and bot ranking tested against projected-state isolation.
- Need plugin-provided rule-tool metadata fully used.

### Security/admin/persistence

- Server npm audit vulnerabilities fixed and deployed by upgrading `@colyseus/core` to `^0.17.44`, `@colyseus/ws-transport` to `^0.17.13`, `@colyseus/monitor` to `^0.17.8`, `@colyseus/schema` to `^4.0.26`, aligning root/server `zod` to v4 where required, and replacing `colyseus.js` with `@colyseus/sdk`.
- Need Supabase RLS/service-role-only write audit against actual policies.
- Need active-run install/update/uninstall blocking tests.
- Need game artifact rejection tests: bad signature, digest mismatch, path traversal, oversized artifact, bad MIME.
- Need admin dashboard for installed games, health, AI, logs, active parties, moderation.
- Need ensure no secrets are tracked or exposed; specifically inspect `.signing/private.pem` in BoredRoom-Games.

### Design and visual regression

- Need exact design comparison ledger for approved references.
- Need native-size screenshot fixtures for landing, tablet, mobile, lobby, display, controller, Games Library, setup, companion, errors, reconnect, waiting, recap.
- Need all non-gameplay screens checked for footer credit.

## Files changed in last completed implementation pass

- `server/src/index.ts`
- `src/components/brand/LagosScene.tsx`
- `src/index.css`
- `src/pages/Index.tsx`
- `src/hooks/useHouseSession.ts`
- `scripts/playwright-bot-autofill.mjs`
- `scripts/playwright-gameplay-matrix.mjs`
- `scripts/smoke-unified-session.mjs`
- `scripts/deploy-dell.sh`
- `package.json`
- `package-lock.json`

## Next recommended agent prompt

Continue from `/Users/hendrix/Playground/boredroom` and do not mark the goal complete. The Lagos hero/motion fix and Colyseus 0.17 deployment are verified live. The deploy script has been hardened and dry-run checked; verify it on the next real Dell deploy. Next production gap: full vote lifecycle or companion control booth.
