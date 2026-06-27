# BoredRoom Implementation Progress

Last updated: 2026-06-27 11:35 WAT (Codex host/controller regression release)

> **BoredRoom 1.6.0.0 + Games 1.4.0.0 live release:** Fixed the issues found in the first Ludo/host pass: host vote overlays are dismissible; the active-game drawer shows current-run pause/resume/end controls instead of the full catalog; pairing creation reports success/failure and the companion screen clearly accepts six digits; the controller wake-lock progress notice is gone; Ludo and Whot controllers no longer render the public host board/table. Whot is now a five-round match (first to three round wins), automatically emits semi-last/last/check-up callouts, and uses eight pre-generated YarnGPT clips across six Nigerian voices on the host display. House sessions persist cross-game standings based on game wins. The homepage game shelf was removed and the setup Games row now opens the library; the unused Players row was removed. GitHub release action `28286637855` published the signed game catalog; Dell has all 15 games at `1.4.0.0`, zero updates, and BoredRoom main through `79f62f0`. Verification: Games 223/223; app 118 passed + 2 skipped; lint/typecheck/PWA/server builds; full 15-game live matrix; and dedicated live Chromium coverage for six-digit pairing, vote dismissal, active controls, end-game, and the companion field.

> **Codex release completion (BoredRoom 1.5.0.0 + Games 1.3.0.1 — 2026-06-27):** Pushed BoredRoom through `3044e4f` and BoredRoom-Games through `b46a82e`, deployed BoredRoom `1.5.0.0` to Dell, and installed all 15 official games at signed version `1.3.0.1`. The first `1.3.0.0` release was deliberately superseded after Dell rejected its generated entrypoint (`source/runtime/game-runtime.js` did not exist). The packager now imports `source/game-runtime.js`, and `verify-release.mjs` extracts every tarball, imports its actual packaged server entrypoint, instantiates the expected runtime, and verifies digest/signature before release publication. GitHub Actions run `28284189103` passed build, 221 tests, signature/loadability verification, release publication, and catalog-to-main publication. Dell catalog reports 15 installed, one version (`1.3.0.1`), no updates. Live Cloudflare evidence passes: health, entry flow, permissions, voting, bot autofill, consecutive games + disconnect/reconnect, and the expanded 15-game matrix. The matrix now uses real assertions for ETTT teams, Faith survey/buzzer, Hustle movement, Landlord auction settlement, Pidgin transcript privacy, and Word board/private-rack behavior. Physical-device microphone and QR-camera checks remain broader product QA work, not a code/release blocker for this completed checkpoint.

> **Codex continuation (four requested game completions — 2026-06-27):** Completed the four prerequisites requested before the signed release. **Oga Landlord** now has server-authoritative bank auctions (open bidding, minimum increments, pass/resolve, ownership/cash settlement) and bilateral property/cash trading with recipient accept/reject, proposer cancellation, stale-asset validation, improved-property protection and snapshot restore; controller/display UI covers custom bids and multi-asset offers. **Word Wahala** is now a turn-based 15×15 Scrabble-style board with centre-first/connectivity/line/cross-word validation, DL/TL/DW/TW scoring, private racks, tile placement, swap/pass, rack penalties, deterministic bot and snapshot restore; its installable runtime dictionary is generated from the existing layered source and contains 1,637 standard/Pidgin/slang/indigenous entries. **Faith Feud** now defaults to private pre-game survey collection and implements representative buzz lock, two-answer faceoff comparison, team control, round bank, unique strikes, one-shot steals, full-board reveal, round advance, bots and recovery. **Pidgin Translator** now defaults to voice-first mode, exposes a microphone/Web Speech transcription controller with permission/error/unsupported handling and typed fallback, and keeps live transcripts out of public state (BoredRoom submits transcript only; no raw audio). Verification before release: BoredRoom Games 220/220 (subsequently 221/221 after artifact regression coverage), focused UI 12/12, full BoredRoom 116 passed + 2 skipped, lint zero warnings, typecheck, PWA build and server build.

> **Claude continuation (LIVE Dell deploy + full smoke — 2026-06-27):** Deployed HEAD `70a099d` to the Dell box (`bash scripts/deploy-dell.sh`); web + server images rebuilt, containers restarted, `/healthz` green. Fixed a real regression found by the live matrix: the new profile-creation gate was re-prompting returning players (legacy `boredroom_player_name` now counts as having a profile). **Full live-smoke set passes against Dell:** health, entry flows, vote lifecycle (resolve + request + override), permissions (non-host blocked), bot autofill, **consecutive-games + reconnect** (trivia→color-wahala in one house, disconnect→auto-pause→reconnect→resume), and the **15-game gameplay matrix** (all 15 PASS incl. browser smoke). Public endpoints live: `https://colyseus.hendrix.com.ng/healthz`, `https://party.hendrix.com.ng/`. Remaining true blockers: signed games artifact release (run `scripts/release.sh` with the key) and physical-device QR camera evidence.

> **Claude continuation (AI content + anti-repeat, every content game):** Replaced reliance on hardcoded banks with a real content system. Server `generateGameContent` produces shape-correct, schema-validated, fail-soft content per game — trivia → MCQs, faith-feud → ranked surveys, logo → brand/hint/category, bible-timeline → ordered events; market-price + color-wahala stay curated/procedural on purpose (real prices + flag facts can't be AI-invented). `aiContentMemory` tracks recently-used prompts per (session, game); a shared `deprioritizeRecent` helper makes **every** content game sink recent items so a long night stops repeating, even with AI off. Runtimes merge AI content ahead of local banks (local = fail-soft fallback). Also expanded Faith Feud surveys (general 6 + church 4) and Color Wahala flags (2→6, fixed a hardcoded-explanation bug). Plus a one-command **signed release script** (`scripts/release.sh` + `verify-release.mjs`) proven end-to-end with an ephemeral key — the signing-key blocker is now a single maintainer command. App suite 106, games suite 207.

> **Claude continuation (companion control booth):** Consolidated the scattered companion fixed panels into a single tabbed `CompanionConsole` (Party/Players/Games/Current/Votes/Settings) — admission queue + kick, game selection + game vote, pause/resume/end-game, vote override/close/apply + history, remote toggle, companion pairing, and an end/delete danger zone gated behind Settings. The public display now keeps only its lightweight Games & controls emergency drawer; heavy host controls live solely on the companion (spec: companion = producer booth, display = stage). 3 render tests; app suite 101.

> **Claude continuation (reference assets + 3D board UI):** Course-corrected to the fork/adapt-first strategy — cloned and audited the priority reference repos. Whot validated **rule-identical** to `mykeels/whot` (same 54-card deck + special-move map). Oga Landlord reconciled to `christelbuchanan/Monopoly-Game` (author permission): added passing-GO bonus + three-doubles→jail on top of the sets/houses/mortgage/jail expansion. Vendored Friendly-Feud's MIT Family-Feud **sound effects** (wired to Faith Feud) and adapted Monopoly-Game's **3D dice/token/card-flip animations**. Built two **dedicated board UIs**: a Landlord board (colour-set tiles, houses/mortgage/jail markers, 3D dice, bank) and a Faith Feud answer board (revealed/covered slots, strikes, team scores, buzzer). Generated **3D-rendered Lagos vehicle tokens** (Danfo/Okada/Keke/Molue) via the image tool and wired them with float/glow/shadow effects. App suite 88 → 98 (render tests for both surfaces). Games suite 199.

> **Claude continuation (GOAL1 player management):** Implemented the full admit/kick/remote triad, all server-authoritative with tests and live smokes. Host/companion can **kick** a player (`cff4399` — notifies + disconnects + pauses if seated), toggle **remote/outsider mode** (same code stays authoritative), and run an **admission queue** when `requireAdmission` is set (`2c0f42f` — new controllers wait pending, can't ready/vote until admitted; admit/reject UI + waiting screen). All three also enact via the vote system (`kick_player`/`remote_mode`/`admit_player` vote types). Main-app tests 88 → 91, all green. Still open in GOAL1: companion tabbed sections, public-display emergency-only drawer, browser-page E2E, recovery/restart E2E, visual-regression ledger, and Dell deploy + live verification (deploy/devices are external blockers).

> **Claude continuation (GOAL2 game runtimes — extended):** Every one of the 15 games now has a dedicated runtime test suite; games suite **126 → 192**, all green. Rebuilt/hardened: Ludo (`cd0ff78`, correct absolute board/captures/safe-zones/exact-finish/three-sixes/bot), Connect 4 (`a6e689a`, team mode + best-of + contributions + bot), ETTT (`ae1e549`, team-mode restore fix), Word Wahala (`f810480`, pass/swap), Faith Feud (`18bc21e`, 1v1-deadlock fix + competent server bot), Half & Half (`00d6076`, anti-repeat + deterministic bot), **Trivia (`3e71175`, fixed a real answer-always-index-0 leak** — options now shuffled), Logo/Market/Pidgin (`4d612d9`, suites incl. answer-no-leak + voice-transcript privacy), Oga Landlord (`8a1a6b7`, fixed a rent owner-lookup bug). P0 safety re-verified (signing material untracked + gitignored). Build pipeline verified healthy with an ephemeral test key (15 artifacts bundle cleanly) — but **official signed artifact rebuild is BLOCKED**: it needs `BOREDROOM_GAMES_SIGNING_KEY` (held by the maintainer). Until that runs, installed artifacts are stale relative to the improved runtimes. Remaining: per-game browser display/controller UI, full Monopoly feature set for Landlord, richer content banks, and the signed artifact release. Not deployed.

Last updated (prior): 2026-06-26 22:05 WAT (Codex GOAL1/GOAL2 verification)

## Current GOAL1 / GOAL2 verification snapshot (2026-06-26 22:05 WAT)

This section supersedes older “current status” notes below where they conflict. The long-running goal is not complete.

### Current repo heads

- BoredRoom: `81ffa8e Advance unified party lifecycle and device flow`
- BoredRoom-Games: `3ba00da Modularize game runtimes and source strategy`
- BoredRoom-Spec: `8456748 Document active production AI model`

### Verification run this checkpoint

- Read `/Users/hendrix/Playground/GOAL1.md` and `/Users/hendrix/Playground/GOAL2.md`.
- Confirmed BoredRoom and BoredRoom-Games worktrees were clean before this docs update.
- Inspected current evidence in source/docs/tests for session lifecycle, votes, PWA/QR/profile, admin, game runtime, source catalog and acceptance matrix.
- Confirmed BoredRoom-Games has 15 game manifests and catalog entries: `bible-timeline`, `color-wahala`, `connect-4`, `ettt`, `faith-feud`, `half-half`, `hustle`, `landlord`, `logo`, `ludo`, `market-price`, `pidgin-translator`, `trivia`, `whot`, `word-wahala`.
- Recent verified gates from the previous pass remain: BoredRoom `npm run lint && npm run typecheck && npm run build`; BoredRoom-Games `npm test` passed 126/126.

### Product status against GOAL1

| Area | Status | Evidence | Remaining gap |
| --- | --- | --- | --- |
| One house session / join once | Partial | `HouseSessionRoom` is the only registered realtime room; unified session scripts exist; live matrix previously passed all 15 games. | Need consecutive-game browser E2E with refresh/reconnect/server restart and no route/code change. |
| Party lifecycle | Partial | Status vocabulary migration and explicit end/delete party landed in `81ffa8e`; docs/tests mention `open_lobby`, `in_game`, `game_recap`, `intermission`, `ended`, `deleted`. | Need full state-machine audit in current code, stronger browser E2E, and confirmation that game end never ends party in all flows. |
| Companion as producer booth | Partial | Companion route/pairing exists; companion vote and party controls exist. | Heavy host controls are still not fully moved from public display into companion; companion needs full Party/Players/Games/Current Game/Votes/Settings/Recap sections. |
| Public display as stage | Partial | Cinematic lobby/game surfaces exist; active game QR strip exists. | Public display still has too much host/control logic; needs emergency-only drawer and visual regression proof. |
| Controller as player hand | Partial | `InstalledGameSurface` sends legal intents and Whot modal/pending-pick UI exists. | Controller flyout/menu, rules, profile, reactions, pause request and private-state isolation need complete per-game E2E. |
| Voting / house democracy | Mostly met | Server-backed active vote/history, player request, override, auto-apply, vote E2E script, admin vote visibility, and vote-driven actions: game_selection (starts game), end_party/end_game/pause/resume, **kick_player and remote_mode** (`cff4399`). | Vote-driven *admit* (needs pending-player model) and team changes still missing; broader UI browser smoke and persistence/restart tests pending. |
| Profiles/avatars | Partial | `PlayerAvatar`, `ProfileSheet`, `playerProfile` exist and join flow carries avatar/accent. | Photo avatar flow, all surfaces/recap/team/vote coverage, offline behavior and size limits not fully proven. |
| PWA / QR / reconnect | Partial | Real `beforeinstallprompt` capture, manifest updates, QR parser, wake lock/persistence helpers exist. | Real iOS/Android camera evidence, offline shell/update prompt tests, phone-lock recovery and server-restart recovery E2E missing. |
| Admin dashboard | Partial | `/admin` route and overview endpoint exist. | Needs installed-game management, logs/events, AI health detail, moderation/content management, active-party controls and vote/session history depth. |
| AI | Mostly met | Server AI service with no-key/schema/**429/402/timeout** fail-soft tests (`21b548e`), private-state isolation, model pin, owner-visible health via `/admin`. Gameplay never blocks; bots/hints fall back to server-generated legal intents. | Recap/commentary/bot-ranking projection-isolation tests and plugin rule-tool metadata still light. |
| Security/persistence | Partial | Owner/admin auth exists for game admin/admin overview; service-role absence is handled. | Supabase RLS/service-role audit, credential replay tests, artifact rejection tests and restart persistence proof missing. |
| Visual/design contract | Partial | Lagos hero/motion and game chrome improved; screenshots were manually referenced. | No automated visual regression ledger against approved screenshots; every screen has not been proven as an exact design match. |
| Release/deploy | Partial | Previous Dell deploy/live checks passed for older commits. | Current `81ffa8e`/`3ba00da` are pushed but not documented as deployed/verified live after push. |

### Game-layer status against GOAL2

| Game / system | Status | Current evidence | Remaining gap |
| --- | --- | --- | --- |
| Shared runtime contract | Partial | Modular runtime files under `runtime/games/*`; `scripts/runtime-contract.test.mjs`; BoredRoom-Games `npm test` passed 126/126. | Contract tests still do not prove full original bespoke mechanics, companion/crowd projections, rematch, update blocking or browser display/controller UI for every game. |
| Shared timer | Partial | `runtime/timer.js`; timer tests for phases, pause/resume, late submissions, fastest and restore. | Timer is not wired into every game/controller/companion flow; no browser proof of timer UI. |
| Whot | Partial / best current game | Full deck, seeded shuffle, special cards, call-shape modal, pending pick and many runtime tests exist. | Compare against `mykeels/whot` + `mykeels/whot-server`; add companion controls, timer, full display/controller component split and browser E2E. |
| Ludo | Runtime rebuilt (BoredRoom-Games `cd0ff78`) | Correct absolute 52-square ring + entry offsets, captures on absolute squares, entry/star safe zones, exact-finish, three-sixes forfeit, extra turns, seeded dice, capture-seeking bot; 9 dedicated tests (suite 135/135). | Browser board/path/home-stretch animation UI and per-color rendering still pending; companion timer/settings. |
| Connect 4 | Runtime rebuilt (BoredRoom-Games `a6e689a`) | Solo + team mode (alternating-side turns, team-credited round wins), best-of-N matches with per-round board history, contribution tracking, win/block bot; 5 dedicated tests (suite 140/140). | Browser board UI for team colours/best-of scoreboard/final review and visual match to `joshtom/connect-four-game` still pending. |
| Bible Timeline Rush | Partial | Runtime/tests cover shuffled order, scoring, reveal, restore. | Needs larger licensed content bank, drag/drop controller, configurable countdown/rounds, AI/manual bank and no-repeat across full session. |
| Color Wahala | Partial | Runtime/tests cover Stroop prompt, misleading ink, flag content, reveal/restore. | Needs richer bank, AI generation/validation, repetition cooldown, speed scoring and browser controller proof. |
| Endless Tic Tac Toe | Runtime solid + restore fixed (`ae1e549`) | Rolling marks, team mode, oldest-mark tracking, target score, bot; team-mode restore now persists roll-off config (was instance-only). 15 tests. | Host final-board-review and controller oldest-mark-warning browser UI still pending. |
| Half & Half | Partial | Runtime exists. | Needs complete split/midpoint/debate mechanic verification, distribution visualization, prompts/settings/tests beyond generic acceptance. |
| Faith Feud | Incomplete | Runtime exists but is not yet adapted from `joshzcold/Friendly-Feud`. | Port/adapt Friendly-Feud host/display/buzzer/reveal/data/timer flow into HouseSession runtime; add team/strikes/steal/reveal tests and UI. |
| Hustle | Partial | Snakes-and-ladders style runtime/tests exist. | Needs richer Nigerian board/content, event density settings, animations/sounds and browser UI. |
| Oga Landlord | Partial, preferred feature source clarified | Existing source comments reference `christelbuchanan/Monopoly-Game`; Hendrix states author permission. Runtime exists and contract passes. | Hendrix prefers `christelbuchanan/Monopoly-Game` features. Preserve permission/attribution evidence, use it as feature target, use `itaylayzer/Monopoly` secondarily for bots/audio/polish, then complete Monopoly mechanics/UI/tests. |
| Logo Guesser | Partial | Runtime exists. | Needs obscured logo bank/reveal stages, safe asset/source policy, categories, no-repeat, hints and browser proof. |
| Word Wahala | Runtime improved (`f810480`) | Tile bag/racks/dictionary scoring, pass + swap intents, no-repeat words, bot, snapshot/restore; 8 dedicated tests. | Full board/crossword placement (currently rack-word spelling), Nigerian/Pidgin dictionary mode, and UI proof still pending. |
| Market Price | Partial | Runtime has cached product snapshot concept and Supermart credit text. | Needs real importer/admin cache flow, DB tables, no-live-network gameplay proof, image fallback, source-credit rendering tests and README credit. |
| Pidgin Translator | Incomplete | Runtime accepts text/voice transcript intents; defaults to text-only. | Needs privacy-safe push-to-talk UI, mic permission/fallback, transcript pipeline, fastest-correct server timestamp, no raw-audio proof and tests. |
| Who Sabi Pass / Trivia | Partial | Runtime exists. | Needs large categories/difficulty/no-repeat/reveal/explanation/AI fallback/team-option tests and UI. |
| Installable artifacts | Partial — BLOCKED on signing key | Build pipeline verified healthy (ephemeral test key builds 15 signed artifacts cleanly). `.signing/` untracked + gitignored. | **Official artifact rebuild needs `BOREDROOM_GAMES_SIGNING_KEY` (maintainer-held).** Source manifests are `1.0.0.0` vs catalog `1.2.0.0`; after the runtime rebuilds, artifacts are stale and must be re-signed + re-released by the key holder, then catalog/version aligned. |

## Claude continuation TODO list

Use this list as the next work queue when Codex hits rate limits. Do not mark GOAL1 or GOAL2 complete until these are all verified.

### P0 — immediate safety and source decisions

- [ ] Record durable attribution/permission evidence for `christelbuchanan/Monopoly-Game` in BoredRoom-Games release docs without exposing private correspondence.
- [ ] Update `BoredRoom-Games/docs/external-game-reference-plan.md` if Hendrix changes any source preferences.
- [ ] Audit whether any source files copied from unlicensed repos remain without permission notes.
- [ ] Confirm `.signing/private.pem` or any signing material is not tracked and is not printed in logs.
- [ ] Re-run `git status` in all three repos before editing.

### P1 — Oga Landlord preferred-source pass

- [ ] Treat `christelbuchanan/Monopoly-Game` as the preferred feature target because Hendrix prefers its features and has author permission.
- [ ] Use `itaylayzer/Monopoly` secondarily for bots, music/sound, React/TypeScript patterns and UI polish.
- [ ] Map Landlord features explicitly: board, roll/move, buy/pass, rent, property sets, building/upgrades, mortgage, chance/wahala cards, taxes/fees, jail/hold-up, auctions, trades, bankruptcy, quick/normal mode.
- [ ] Convert/adapt those mechanics into server-authoritative `GameRuntime` only; do not import standalone rooms, PeerJS rooms, client-authoritative state or external route flow.
- [ ] Add/expand Landlord runtime tests for movement, buying, rent, sets, upgrades, mortgage, chance/wahala, jail, auctions/trades where implemented, bankruptcy, restore and bot behavior.
- [ ] Update Landlord display/controller/companion UI to expose the richer feature set.

### P1 — source-guided game rebuilds

- [ ] Whot: compare current runtime against `mykeels/whot` and `mykeels/whot-server`; close rule gaps; add companion timer/settings controls and browser E2E.
- [ ] Faith Feud: adapt `joshzcold/Friendly-Feud` board/reveal/buzzer/data/timer flow into BoredRoom’s runtime; add team/strikes/steals/reveal tests.
- [ ] Connect 4: audit `joshtom/connect-four-game` with ISC attribution; add team mode, best-of rounds, contribution tracking and visual board review.
- [ ] Ludo: compare against listed Ludo references; implement real paths, safe zones, exact finish, home stretch, captures, extra-turn/three-sixes rules and animation-ready public state.
- [ ] Word Wahala: use `rcdexta/react-scrabble` patterns; complete board/rack/crossword/dictionary/pass/swap.
- [ ] Logo/Market/Color/Trivia/Bible/Half-Half/Pidgin: expand content/mechanics until each is a real party game, not a generic challenge skin.

### P1 — companion/control flow

- [ ] Move primary game selection/configuration/player/vote controls into the companion control center.
- [ ] Keep public display as cinematic stage with only emergency drawer controls.
- [ ] Build companion sections: Party, Players, Games, Current Game, Votes, Settings, Recap, Admin/Diagnostics.
- [ ] Add game configuration screens for every game before start with universal and game-specific settings.
- [ ] Ensure active gameplay never shows the game list unless game is finished/abandoned.

### P1 — vote lifecycle completion

- [ ] Implement vote side effects for admit pending player, kick/remove player, remote mode, team change and choose-next-game from recap.
- [ ] Add admin dashboard vote visibility and vote/session history.
- [ ] Add browser-page vote UI smoke tests for display/controller/companion, not only websocket/script checks.
- [ ] Add persistence/reconnect/server-restart tests for active vote state.
- [ ] Verify one vote per eligible player/device and crowd eligibility server-side.

### P1 — reconnect/PWA/QR

- [ ] Add refresh/reconnect/server restart E2E proving profile, role, active game private state, vote state and ready state are restored.
- [ ] Add Android/iOS manual or automated QR camera evidence: permission denied, no camera, insecure origin, manual fallback, track teardown.
- [ ] Test phone lock/background/visibilitychange/pagehide/freeze path and host pause/resume behavior.
- [ ] Finish PWA icon/favicon/maskable/apple-touch assets to attached direction.
- [ ] Add offline shell/update prompt tests.

### P1 — AI completion

- [ ] Expose owner-visible AI health/model/latency/rate-limit/credit/fallback status in admin/owner surfaces.
- [ ] Add server-side AI rule explanations, invalid-move explanations, game recommendations, structured recaps and moderation.
- [ ] Ensure plugin rule-tool metadata exists and is used.
- [ ] Add tests for no-key, timeout, 402/credit exhaustion, 429/rate limit, schema failure and projected-state isolation.
- [ ] For bots, ensure LLM never invents moves; bots only rank legal intents.

### P1 — installable games/security/persistence

- [ ] Align source manifest versions, catalog versions and artifact versions.
- [ ] Rebuild official signed artifacts with the official signing key through the release flow.
- [ ] Add artifact rejection tests: bad signature, digest mismatch, bad MIME, oversized archive and path traversal.
- [ ] Add active-run install/update/uninstall blocking tests.
- [ ] Add history-survives-uninstall and server-restart persistence integration tests.
- [ ] Audit Supabase RLS/server-only writes and pack/game-admin auth cookies/origin validation.

### P2 — visual/design proof

- [ ] Create visual regression fixtures at approved screenshot aspect ratios for landing, tablet, mobile, lobby, display, controller, Games Library, setup, companion, crowd/waiting, errors, reconnect and recap.
- [ ] Build a mismatch ledger and block release on material visual drift.
- [ ] Verify every non-gameplay screen has the footer credit.
- [ ] Verify skyline/stars/shooting stars/mouse trails remain visible after deployments.

### P2 — release/live verification

- [ ] Run full local gates: `npm run lint`, `npm run typecheck`, `npm test`, `npm run build`, `npm --prefix server run build`, BoredRoom-Games `npm test`, BoredRoom-Games signed build.
- [ ] Run smoke scripts: `smoke:ui-entry`, `smoke:votes`, `smoke:gameplay`, `smoke:e2e`, server start smoke.
- [ ] Deploy current heads to Dell only after gates pass.
- [ ] Verify Cloudflare live: `/`, `/games`, `/admin`, `/join`, Colyseus `/healthz`, all 15 games, vote lifecycle, reconnect and QR/manual fallback.
- [ ] Update `docs/IMPLEMENTATION_PROGRESS.md` and `docs/CODEX_HANDOFF.md` with exact command output and live evidence.

## Latest pass (2026-06-26 21:00 WAT, user-supplied stronger fork candidates)

### What changed

- User supplied stronger external game sources:
  - Oga Landlord / Monopoly: `itaylayzer/Monopoly`
  - Whot: `mykeels/whot-server`, `mykeels/whot`
  - Faith Feud: `joshzcold/Friendly-Feud`
  - Connect 4: `joshtom/connect-four-game`
- Updated `BoredRoom-Games/docs/external-game-reference-plan.md` to make those the preferred candidates where license/architecture allows.

### Candidate audit result

- `itaylayzer/Monopoly`: MIT, TypeScript/React, includes bots, sounds/music, board/property UI and online/PeerJS concepts. This should replace `intrepidcoder/monopoly` as the primary Oga Landlord source.
- `mykeels/whot` and `mykeels/whot-server`: MIT, direct Nigerian Whot rules/API/server references. Keep as primary Whot source.
- `joshzcold/Friendly-Feud`: MIT, TypeScript/Next frontend plus Go backend, admin/display/buzzer flows, data import, timers/audio and Playwright E2E. This should replace `yulrizka/fam100` as the primary Faith Feud source.
- `joshtom/connect-four-game`: `package.json` declares ISC, but no standalone LICENSE file was detected via GitHub metadata. Treat as user-preferred reference; vendor only with explicit attribution/license preservation, otherwise keep `kenrick95/c4` MIT as fallback.
- `christelbuchanan/Monopoly-Game`: existing Landlord source comments say parts were ported from this repo. GitHub metadata shows no detected public license, but Hendrix states he has permission from the author. Preserve attribution/permission evidence in release notes before shipping.

### Implementation consequence

- Do not continue expanding the current hand-written Oga Landlord runtime until it is compared against `itaylayzer/Monopoly`.
- Do not build Faith Feud from a blank design; port/adapt Friendly-Feud’s host/display/buzzer/reveal flow into BoredRoom’s HouseSession runtime.
- Any adapted code still must be converted to server-authoritative `GameRuntime` modules; external rooms, PeerJS rooms, standalone websocket rooms and client-authoritative state cannot survive as production architecture.

## Latest pass (2026-06-26 20:25 WAT, fork-first game implementation correction)

### What changed

- User clarified that standard games should not be rebuilt blind from scratch.
- Added a fork/adapt-first reference plan in `BoredRoom-Games/docs/external-game-reference-plan.md`.
- Verified the split local objectives are `GOAL1.md` and `GOAL2.md`.
- Current worktrees are dirty; do not assume a clean baseline before staging.

### Historical candidates found, now superseded where noted

- Oga Landlord / Monopoly: `intrepidcoder/monopoly` (MIT) — demoted to secondary reference after user supplied `itaylayzer/Monopoly`.
- Whot: `mykeels/whot` and `mykeels/whot-server` (MIT).
- Connect 4: `kenrick95/c4` (MIT) — keep as fallback if `joshtom/connect-four-game` package-level ISC license is not sufficient.
- Ludo: `smokelaboratory/fludo` (Apache-2.0, Dart/Flutter reference).
- Word Wahala: `rcdexta/react-scrabble` (MIT).
- Faith Feud: `yulrizka/fam100` (MIT) — demoted to secondary reference after user supplied `joshzcold/Friendly-Feud`.
- Logo Guesser: `syxanash/logosweeper` and `swapnilrane24/Logo-Quiz` (MIT).
- Color Wahala: `khrigo/TrueOrFalseColor` (MIT).
- Market Price: `Amine-Smahi/UPrice` (MIT).

### Tests run during this pass

- `BoredRoom-Games`: `npm test` initially exposed a Landlord contract bug after expanding the test script to include `games/*/tests/*.test.mjs`.
- Fixed Landlord to block rolling while buy/pass is pending and corrected its mode from `hustle` to `landlord`.
- `BoredRoom-Games`: `npm test` now passes 126/126 locally.
- `BoredRoom-Games`: `npm run build` passes when an ephemeral local Ed25519 signing key is supplied.
- `BoredRoom`: `npm run lint`, `npm run typecheck`, and `npm run build` passed after the current Whot UI edits.

### Remaining caution

- The local signed catalog was regenerated with a temporary key during verification and must not be treated as an official release catalog.
- Do not deploy or release these game artifacts until the official signing key and release flow are used.
- Oga Landlord should be revisited against `itaylayzer/Monopoly` before expanding the current runtime. Current `christelbuchanan/Monopoly-Game`-derived code has stated author permission from Hendrix, but the release record should preserve that evidence and attribution.

## Latest pass (2026-06-26 16:53 WAT, Phase 0 — Game Layer Rebuild Foundation — DeepSeek V4 Pro continuation)

### What was done

**Runtime restructure:**
- Extracted `runtime/game-runtime.js` (876-line monolith) into modular files:
  - `runtime/helpers.js` — shared: `RuntimeBase`, `makeRng`, `shuffleInPlace`, `clone`, `normalize`, `topPlayers`
  - `runtime/timer.js` — server-authoritative timer system (see below)
  - `runtime/games/whot.js` — Whot runtime extracted, with fixes (discard reshuffle, Whot call-shape enforcement, multi-round scoring, bot ranking for all specials)
  - `runtime/games/ludo.js` — Ludo runtime extracted
  - `runtime/games/connect4.js` — Connect 4 runtime extracted
  - `runtime/games/ettt.js` — ETTT runtime extracted
  - `runtime/games/challenge.js` — ChallengeRuntime + CHALLENGE_DEFINITIONS extracted
- `runtime/game-runtime.js` now imports from per-game modules and re-exports the same API (backward compat)
- Each module is independently testable: `node --test runtime/games/whot.test.mjs` (when created)

**Timer system:** Full server-authoritative timer built per GOAL2.md spec:
- Phases: pre_countdown → accepting_answers → locked → reveal → countdown_to_next → complete
- Actions: start, pause, resume, extend, lock, skip, forceReveal
- Submission tracking with server timestamps (speed determined by server time, not client)
- Scoring modes: correctness_only, correctness_plus_speed_bonus, fastest_correct_wins, ranked_speed_points, closest_answer_plus_speed_bonus
- Late submission rejection, duplicate rejection, early reveal threshold
- Snapshot/restore for reconnect safety
- 14 timer tests all passing

**Build updates:**
- `scripts/build-catalog.mjs` now copies the full runtime/ directory into artifacts (instead of just game-runtime.js), so per-game module imports resolve correctly
- `package.json` test script uses `--test-force-exit` to avoid Node.js runner hang on lingering setTimeouts
- 37 tests pass total: 22 runtime-contract + 14 timer + 1 catalog

### Current build gates
- BoredRoom-Games: `npm test` — 37/37 pass
- `npm run build` (catalog) — needs verification

### Carried forward
Next phases per `docs/game-layer-phases.md`:
- Phase 1: Whot proper rebuild (round-end screen, multi-round scoring, companion controls, tests)
- Phase 2: Ludo + Hustle board games
- Phase 3: Connect 4 + ETTT + Word Wahala grid games
- Phase 4: Bible Timeline + Color Wahala + Who Sabi Pass content games
- Phase 5: Faith Feud + Half & Half social games
- Phase 6: Logo Guesser + Market Price + Pidgin Translator special games
- Phase 7: Oga Landlord Nigerian board game
- Phase 8: AI Content System
- Phase 9: Game-specific UI components
- Phase 10: Integration, E2E, deploy

### Next recommended prompt
"Continue Phase 1: Whot rebuild. The foundation (runtime restructure + timer) is done with 37 tests passing. Rebuild Whot with proper game-specific logic per GOAL2.md — round-end scoring, multi-round tracking, discard reshuffle fix, companion controls, full test suite. Then update the Whot render path in InstalledGameSurface."

## Latest pass (2026-06-26 16:10 WAT (Claude continuation)

### Profiles & avatars (#3a)
- `src/lib/playerProfile.ts`: persistent per-device profile (display name, emoji avatar, accent colour, sound/haptics/language prefs) with legacy-key sync.
- `PlayerAvatar` (one avatar surface everywhere — emoji or accent-tinted initial, never a broken image) and `ProfileSheet` (create/edit).
- Create-profile gate before the controller; edit from the waiting view. Avatar + accent colour flow through join options → `SessionMember` (server) and render in the lobby player list with a ready badge.
- `SessionMember` gained `avatar`/`accentColor` on server + client types; `upsertSessionMember` and room `onJoin` carry them.

### PWA / QR hardening (#3b)
- Removed the faked `beforeinstallprompt` dispatch. New `initInstallPromptCapture()` stores the real event; landing button calls `promptInstall()` with iOS-Safari and desktop A2HS toast fallbacks and hides when already installed.
- Manifest: `display_override: [fullscreen, standalone, minimal-ui]`. `index.html`: aligned `theme-color` to brand `#45f36b`, added `viewport-fit=cover` for safe areas.
- QR scanner: insecure-origin (non-https) warning, friendlier NotAllowed/NotFound permission messages, retains user-gesture stream acquisition + manual-code fallback + track teardown.

Gates (all green): typecheck, lint, test (88 passed / 2 skipped), client build (manifest verified), server build.

Carried forward: favicon/PWA icon redesign to the attached direction (needs the design asset), vote-driven admit/kick/remote_mode, per-game rebuilds (GOAL2.md). Not yet deployed to Dell.

## Latest pass (2026-06-26, party-status migration + admin dashboard)

Two acceptance items landed.

### 1. Party-status vocabulary migration
`HouseSessionStatus` now uses the spec vocabulary: `draft`, `open_lobby`, `selecting_game`, `configuring_game`, `in_game`, `game_recap`, `intermission`, `ending_confirm`, `ended`, `deleted`. Mapping applied: setup→open_lobby (created state), waiting_for_players→configuring_game (on game select), voting→selecting_game, game_active→in_game, recap→game_recap, next_decision→intermission. Pause is now a game-run concern only (`activeRun.status==='paused'`); the party stays `in_game`. Updated: `foundations.ts` transition map + builder, all `sessionDirectory` setters, the `SessionScreen` recap check, and tests. Live: created session reports `open_lobby`; vote lifecycle smoke still passes.

### 2. Admin dashboard (server back office)
- Server `GET /admin/overview` (game-admin session + origin guarded): server protocol/uptime/env, AI health, installed/available game counts, active-party list (code, status, player/connected/bot counts, active game+run status, active vote, recent vote count), and recent votes aggregated across all houses. No secrets — codes and counts only.
- `sessionDirectory.listSessionSummaries()` and `listRecentVotesAcrossSessions()`.
- New `/admin` route + `AdminDashboard.tsx`: passphrase unlock (reuses game-admin auth), auto-refresh every 5s, stat tiles, active-parties table, recent-votes list.
- Live smoke: 403 without auth, 200 + live overview after login.

Gates (all green): typecheck, lint, test (88 passed / 2 skipped), client build, server build.

Carried forward: profiles/avatars, PWA/QR hardening, vote-driven admit/kick/remote_mode, per-game rebuilds (via GOAL2.md). Not yet deployed to Dell.


## Latest pass (2026-06-26, explicit End Party / Delete Party)

Acceptance criteria #2/#3: party end and party delete are now separate, explicit, confirmed actions, distinct from ending a game.

Completed:

- `HouseSessionStatus` enum gained `ending_confirm` and `deleted` (additive; existing statuses unchanged). `foundations.ts` transition map and `selectResumableSession` updated so ended/deleted parties are not resumable.
- `sessionDirectory.endSession(code)`: closes the house, clears active runtime/vote, sets status `ended`, keeps the record so resume shows "ended" not an invalid code (history preserved).
- `sessionDirectory.deleteSession(code)`: emits a final `party.deleted` snapshot, then tears down the in-memory record, that session's pairings, votes, and listeners.
- `HouseSessionRoom` messages: `session:end_party` (host) and `session:delete_party` (host; requires the house code echoed in `payload.confirm` so it can't fire by accident). Both clear vote/bot timers and persist an audit event.
- `useHouseSession` exposes `endParty()` and `deleteParty(confirm)`.
- `SessionScreen`: companion-only "Party controls" danger panel (End party → confirm; Delete party → type code to confirm). All devices get a clean "Party ended" / "Party deleted" screen with a route back to host/join.
- Tests: `endSession`/`deleteSession` unit tests in `sessionAuthority.test.ts` (88 passed total).

Gates (all green): `npm run typecheck`, `npm run lint`, `npm test -- --run` (86 passed / 2 skipped → 88 incl. new), `npm run build`, `npm --prefix server run build`. Live smoke against a local built server: end party notifies host+player, wrong delete confirm rejected, correct code deletes. PASS.

Follow-up done same pass: `session:call_vote` now accepts any valid `HouseVoteType` (zod-validated), and `applyVoteSideEffects` enacts binary action votes when the winning option is affirmative — `end_party` (ends the party), `end_game`, `pause_game`, `resume_game`. Live smoke: two players vote Yes on an `end_party` vote with autoApply → party ends. PASS.

Also done: public display now shows a cinematic read-only vote overlay (live tally bars, winner/tie/override result) across lobby, active game, and recap.

Carried forward: recap mention of votes, admin dashboard, party-status vocabulary migration for the in-game statuses (`game_active`→`in_game` etc. still legacy), and vote-driven admit/kick/remote_mode/team_change side effects. Not yet deployed to Dell.

## Latest pass (2026-06-26, vote lifecycle round 3)

Continued the vote lifecycle. No version bump (per instruction).

Completed:

- Server-side game start from a resolved `game_selection` vote: `findInstalledGameId` (matches a vote option by game id or display name) in `installedGames.ts`; `applyVoteSideEffects` in `HouseSessionRoom` selects the winning installed game when a `game_selection` vote is applied (auto or manual) and nothing is already running. Other vote types are still applied for the audit trail and acted on by the host.
- Companion vote-history view: the vote control booth now also renders recent resolved votes (winner, cast/eligible counts, override/auto markers) and stays visible when there is no active vote.
- `scripts/playwright-vote-lifecycle.mjs` extended with a second scenario: a player-requested vote (`vote:request`) and a host override (`vote:override`), asserting creator + override metadata.

Gates run (all green): `npm run typecheck`, `npm run lint`, `npm test -- --run` (84 passed / 2 skipped), `npm run build`, `npm --prefix server run build`. Live-style smoke run against a local built server: `BOREDROOM_HTTP_URL=http://127.0.0.1:2567 BOREDROOM_WS_URL=ws://127.0.0.1:2567 node scripts/playwright-vote-lifecycle.mjs` → PASS (resolved + player-requested + override).

Carried forward: admin dashboard vote visibility, browser-level (real Playwright page) vote UI smoke, recap mention of major votes, and Dell deploy + live smoke. Not yet deployed.

## Latest pass (2026-06-26, vote lifecycle round 2)

Continued from Codex's first vote slice (`d3d196b`). Version bumped `1.3.1.0 → 1.4.0.0`.

Completed:

- Server `vote:override` message (host-only): resolves the active vote with a host-chosen winner and persists `vote.resolved` with `override: true`.
- Server `vote:request` message (controller/crowd): players can call a house vote, gated by new `allowPlayerVotes` party setting (+ `allowCrowdVotes` for crowd), `voteCooldownMs` rate limit, and a no-overlapping-open-vote guard.
- Auto-apply: `maybeAutoApply` applies + archives a resolved vote automatically when the vote's `settings.autoApply` is set and an outright winner exists. Wired into close, cast-resolve, override, and the expiry/resolution timer.
- New party setting `allowPlayerVotes` (default true) in `shared/src/contracts/session.ts` and frontend `serverApi` settings type.
- `useHouseSession` now exposes the full documented vote API: `requestVote`, `closeVote`, `cancelVote`, `applyVoteResult`, `overrideVote` (plus existing `callVote`/`castVote`). `callVote` accepts type/question/settings overrides.
- Companion-only vote control booth panel in `SessionScreen` (close / cancel / apply / per-option override).
- Controller "Call a house vote" affordance in the waiting view, shown only when `allowPlayerVotes` and no active vote.
- New engine test: applied result carries `autoApplied` from settings.

Gates run (all green): `npm run typecheck`, `npm run lint`, `npm test -- --run` (84 passed / 2 skipped), `npm run build`, `npm --prefix server run build`.

Not yet done (carried forward): server-side game-start from a resolved `game_selection` vote (currently companion confirms the winner), companion vote-history view, admin dashboard vote visibility, and browser E2E for the new request/override/auto-apply paths (extend `scripts/playwright-vote-lifecycle.mjs`). Not yet deployed to Dell.

## Prior pass

Last updated: 2026-06-26 15:25 WAT

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

- HEAD: `d3d196b Add server-backed vote lifecycle state`
- Live Dell deployment verified after this commit.
- `docs/` did not exist before this pass; this file and `docs/CODEX_HANDOFF.md` were created as the baseline handoff docs.

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
- Voting now has a first server-authoritative lifecycle slice: shared vote contracts use spec-style statuses, votes include settings/results, session snapshots expose `activeVote`/`voteHistory`, and HouseSessionRoom uses session-backed vote state instead of a loose in-room tally map.
- Whot/Ludo visual surfaces were improved in the main installed surface.
- Server-side AI now uses structured JSON-schema responses with deterministic fallback and private-state isolation tests.
- Deterministic session bots exist in `HouseSessionRoom`; bots act only through server-generated legal intents.
- Live Dell checks after bot work passed:
  - Cloudflare health: `https://colyseus.hendrix.com.ng/healthz`
  - entry smoke: `scripts/playwright-entry-flows.mjs`
  - bot autofill: `scripts/playwright-bot-autofill.mjs`
- Latest 15-game matrix after vote lifecycle deployment: `scripts/playwright-gameplay-matrix.mjs` with `PASS 15 games through CN76`
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
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-vote-lifecycle.mjs`
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs`

Latest live evidence:

- `curl -fsS https://colyseus.hendrix.com.ng/healthz` returned `{"ok":true,"transport":"colyseus","version":3}`.
- `curl -fsSI https://party.hendrix.com.ng/` returned HTTP 200 with `last-modified: Fri, 26 Jun 2026 12:27:21 GMT`.
- `PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-entry-flows.mjs` passed.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-bot-autofill.mjs` passed with bot seated in `NV7C`.
- `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs` passed all 15 games through `YHQG`.
- After `d3d196b`: `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng node scripts/playwright-vote-lifecycle.mjs` passed with vote `vote_mqv0okiih5n6lx` through `EYSF`.
- After `d3d196b`: `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-bot-autofill.mjs` passed with bot seated in `XNG6`.
- After `d3d196b`: `BOREDROOM_HTTP_URL=https://colyseus.hendrix.com.ng BOREDROOM_WS_URL=wss://colyseus.hendrix.com.ng PLAYWRIGHT_BASE_URL=https://party.hendrix.com.ng node scripts/playwright-gameplay-matrix.mjs` passed all 15 games through `CN76`.

Release-process hardening:

- `scripts/deploy-dell.sh` no longer lets `docker compose up -d` run after a failed `docker compose build`; the optional container removal is grouped separately.
- Health check now suppresses transient curl noise, retries for 60 seconds, and prints `docker compose ps` plus recent server logs before exiting non-zero on failure.
- Verified locally with `bash -n scripts/deploy-dell.sh` and `DRY_RUN=1 bash scripts/deploy-dell.sh`.
- Verified against Dell with `bash scripts/deploy-dell.sh`: both web/server Docker images built, containers restarted, `/healthz` passed, and the script exited zero only after the health check succeeded.

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
- Vote lifecycle now has server-side active vote state, timed resolution, quorum/majority/tie/expiry result objects, host close/cancel/apply messages, session snapshot restoration, vote event persistence attempts, and controller result display. Still missing full companion vote-management UI, controller-requested votes/support threshold, auto-application across all vote types, admin visibility, and broad browser E2E.
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
- `shared/src/contracts/session.ts`
- `shared/src/votes/engine.ts`
- `server/src/sessionDirectory.ts`
- `server/src/rooms/HouseSessionRoom.ts`
- `src/lib/serverApi.ts`
- `src/hooks/useHouseSession.ts`
- `src/pages/SessionScreen.tsx`
- `src/test/voteEngine.test.ts`
- `src/test/sessionAuthority.test.ts`
- `src/components/brand/LagosScene.tsx`
- `src/index.css`
- `src/pages/Index.tsx`
- `src/hooks/useHouseSession.ts`
- `scripts/playwright-bot-autofill.mjs`
- `scripts/playwright-gameplay-matrix.mjs`
- `scripts/playwright-vote-lifecycle.mjs`
- `scripts/smoke-unified-session.mjs`
- `scripts/deploy-dell.sh`
- `package.json`
- `package-lock.json`

## Next recommended agent prompt

Continue from `/Users/hendrix/Playground/boredroom` and do not mark the goal complete. The Lagos hero/motion fix, Colyseus 0.17 deployment, hardened Dell deploy script, and first vote lifecycle/server-state slice are verified live. Continue toward full vote lifecycle: companion vote management UI, player-requested votes/support, auto-apply actions, admin visibility, and browser E2E.
