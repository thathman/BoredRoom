# Game Layer Rebuild — Complete Phase Map

References: GOAL2.md, BoredRoom-Spec/15-current-product

## Current State (Audited)

**Runtime:** Single 876-line `runtime/game-runtime.js` contains all game logic. 4 games have dedicated runtimes (Whot, Ludo, Connect 4, ETTT). 11 games run as `ChallengeRuntime` generic skins with 2-3 hardcoded rounds each.

**Source stubs:** Every game's `source/` folder contains 3-line stubs for server.js, display.js, controller.js. No companion.js, no crowd.js, no tests/.

**Legal intent leak:** ChallengeRuntime.legalIntents() returns the actual correct answer in `amount`, `text`, or `orderedIndexes` fields.

**Frontend:** Single 633-line `InstalledGameSurface.tsx` handles ALL games via `state.mode` branching.

**Timer:** None. No server-authoritative timer system exists.

**Tests:** Contract test loop + 5 Whot-specific + 1 each Connect4/ETTT/Ludo. Zero tests for the 11 challenge games.

## Phase Map (execution order)

Each phase produces independently shippable, testable, deployable work.

### Phase 0 — Foundation
**Goal:** Shared infrastructure every game depends on.

- Extract `runtime/game-runtime.js` into `runtime/helpers.js` (clone, shuffle, RNG, RuntimeBase) + per-game modules under `runtime/games/`
- Build `runtime/timer.js` — server-authoritative timer with all phases, pause/resume, speed scoring, snapshot/restore
- Build `scripts/timer.test.mjs` — full timer test suite
- Create game directory template: `games/<id>/source/{server,display,controller,companion,crowd}.js` + `tests/`
- Update `scripts/build-catalog.mjs` for modular packaging
- Update `scripts/runtime-contract.test.mjs` to test per-game modules directly
- **Games affected:** None directly (infrastructure only)
- **Deliverable:** New runtime module structure, timer passing all tests, build pipeline working

### Phase 1 — Card Game: Whot
**Goal:** Whot feels like real Whot. Pattern-setter for all future game-specific runtimes.

- Extract WhotRuntime to `runtime/games/whot.js` with fixes:
  - Deck reshuffle on empty draw pile
  - Proper Whot call-shape enforcement (not auto-Circle)
  - Pick 2/5 stacking chain (defense)
  - Multi-round scoring (pips-based, configurable win target)
  - `rankBotIntent` for all special cards
  - Settings: specialCards on/off, handSize, scoringMode, roundCount, turnTimer
- Update `games/whot/source/display.js` — proper Whot table with player positions
- Update `games/whot/source/controller.js` — hand view with playable highlights, draw, call-shape modal
- Create `games/whot/source/companion.js` — settings, timer controls
- Create `games/whot/tests/runtime.test.mjs` — full test suite
- Wire timer into Whot (turn timer, auto-draw on timeout)
- **Games affected:** whot only
- **Deliverable:** Proper Whot with timer, tests, companion, controller

### Phase 2 — Board Games: Ludo + Hustle
**Goal:** Movement-based board games with proper board logic.

#### Ludo
- Extract LudoRuntime to `runtime/games/ludo.js` with fixes:
  - Proper seeded dice RNG (not hardcoded sequence)
  - Per-player paths with correct offsets
  - Home stretch and exact-roll-to-finish
  - Safe squares (star positions)
  - Captures (send opponent token to yard)
  - Extra turn on six
  - Optional 3-sixes penalty
  - Settings: quick/normal mode, capture rules, dice rules, turn timer
- Create `games/ludo/tests/runtime.test.mjs`
- Wire timer (turn timer, auto-roll on timeout)

#### Hustle
- Create `runtime/games/hustle.js` — Snakes-and-Ladders-style board:
  - Board path with positions
  - Ladders (opportunities, breakthroughs, helper, contract, alert)
  - Snakes (wahala, billing, traffic, scam, landlord, fuel scarcity)
  - Event cards with Naija hustle situations
  - Dice + movement
  - Win condition (first to final square)
  - Settings: board length, dice mode, event density, quick/normal
- Create `games/hustle/source/` files
- Create `games/hustle/tests/runtime.test.mjs`
- **Games affected:** ludo, hustle
- **Deliverable:** Both games playable with proper boards, dice, capture/movement, timer, tests

### Phase 3 — Grid Games: Connect 4 + ETTT + Word Wahala
**Goal:** Grid-based games with proper game-specific mechanics.

#### Connect 4
- Extract to `runtime/games/connect4.js` with fixes:
  - Team mode (discs belong to team, players rotate within team)
  - Best-of rounds
  - Player contribution tracking
  - Bots (simple column-priority)
- Create `games/connect-4/tests/runtime.test.mjs`

#### ETTT (Endless Tic Tac Toe)
- Rewrite to `runtime/games/ettt.js` as actual Endless/Rolling TTT:
  - 3x3 board with limited active marks (default 3 per player)
  - Placing new mark removes oldest mark
  - Win detection after rolling removal
  - Oldest mark preview
  - Team mode
- Create `games/ettt/tests/runtime.test.mjs`

#### Word Wahala
- Create `runtime/games/word-wahala.js` — Scrabble-like:
  - Tile bag with letter values
  - Private racks
  - Board with word placement
  - Cross-word validation
  - Dictionary validation (Nigerian/Pidgin mode option)
  - Pass/swap
  - Score calculation
- Create `games/word-wahala/source/` files
- Create `games/word-wahala/tests/runtime.test.mjs`
- **Games affected:** connect-4, ettt, word-wahala
- **Deliverable:** Three grid games working with team modes, proper mechanics, tests

### Phase 4 — Content Games: Bible Timeline + Color Wahala + Who Sabi Pass
**Goal:** Question/quiz games with content banks, no-answer-leakage, progressive reveal.

#### Bible Timeline Rush
- Create `runtime/games/bible-timeline.js`:
  - Hidden canonical order, randomized visible order
  - No correct-order leakage in legal intents
  - Larger content bank (AI + manual)
  - Difficulty levels with Bible reference/explanation
  - Drag/drop ordering (submitted as indices, not canonical order)
  - All-submit auto reveal, reveal countdown, next-round auto advance
  - Scoring: exact position points, relative order points, perfect bonus, speed bonus
- Create `games/bible-timeline/tests/runtime.test.mjs`
- Create content bank module

#### Color Wahala
- Create `runtime/games/color-wahala.js` — real Stroop game:
  - Word vs ink color separation
  - Misleading ink colors
  - Safe flag-color prompts
  - Answer timer, speed scoring
  - Content bank with category support
  - AI-generated prompt support with validation
  - No ambiguous prompts (e.g., "what color?")
- Create `games/color-wahala/tests/runtime.test.mjs`

#### Who Sabi Pass (Trivia)
- Create `runtime/games/trivia.js`:
  - Large question bank with categories (Nigerian culture, geography, history, music, Nollywood, sports, food, internet culture, slang, general knowledge)
  - Difficulty levels
  - No repeats within session
  - Timed answers with speed bonus
  - AI-generated question support with moderation
- Create `games/trivia/tests/runtime.test.mjs`
- **Games affected:** bible-timeline, color-wahala, trivia
- **Deliverable:** Three content-rich quiz games with proper scoring, no leak, AI support

### Phase 5 — Social Games: Faith Feud + Half & Half
**Goal:** Social/survey-based party games.

#### Faith Feud
- Create `runtime/games/faith-feud.js`:
  - Survey setup/generation phase
  - Team setup
  - Face-off phase
  - Active round with answer matching (fuzzy/aliases)
  - Strike/steal mechanics
  - Round scoring with answer bank points
  - AI-generated survey packs with moderation
  - Pre-game player survey option
- Create `games/faith-feud/tests/runtime.test.mjs`

#### Half & Half
- Create `runtime/games/half-half.js`:
  - Three modes: split_vote, midpoint_guess, debate
  - Split vote: choose side, score based on majority/minority prediction
  - Midpoint guess: submit number, score based on closeness to median
  - Distribution reveal with visualization data
  - Tie handling
- Create `games/half-half/tests/runtime.test.mjs`
- **Games affected:** faith-feud, half-half
- **Deliverable:** Social party games with multi-phase gameplay, distribution reveals

### Phase 6 — Special Games: Market Price + Logo Guesser + Pidgin Translator
**Goal:** Games with unique mechanics (pricing, images, voice).

#### Logo Guesser
- Create `runtime/games/logo.js`:
  - Logo bank with categories
  - Progressive reveal (blur → crop → pixelate → mask → full)
  - Multiple choice or typed answer
  - Hint support (category, first letter, industry)
  - Speed + correctness scoring
  - Logo source configuration (logo.dev or manual packs)
  - No live external calls during gameplay
- Create `games/logo/tests/runtime.test.mjs`

#### Market Price
- Create `runtime/games/market-price.js`:
  - Cached product snapshots (curated + Supermart.ng imports)
  - Immutable price snapshots per round
  - Product image + name display
  - Price estimation with tolerance scoring
  - Source credit on reveal
  - Admin import/sync dashboard
  - No live fetching during gameplay
- Create `games/market-price/tests/runtime.test.mjs`
- Create server-side import pipeline for Supermart.ng

#### Pidgin Translator
- Create `runtime/games/pidgin-translator.js`:
  - Voice modes: speed_voice (default), accuracy_voice, text_only
  - Push-to-talk recording with mic constraints
  - Server-side speed determination (not transcription time)
  - On-device speech → Web Speech → server transcription fallback
  - No raw audio in public state, recap, or between players
  - Text fallback always available
  - Privacy-safe: no background recording, no live broadcast
  - Content bank with categories (everyday pidgin, Lagos slang, market phrases, etc.)
  - Scoring: fastest correct weighted
- Create `games/pidgin-translator/tests/runtime.test.mjs`
- **Games affected:** logo, market-price, pidgin-translator
- **Deliverable:** Three special-mechanic games with privacy-safe voice, cached pricing, progressive reveal

### Phase 7 — Nigerian Board Game: Oga Landlord
**Goal:** Monopoly-inspired Nigerian property game.

- Create `runtime/games/landlord.js`:
  - Board with Nigerian properties
  - Dice roll + movement
  - Buy/pass properties
  - Rent collection with sets
  - Property upgrades (if feasible)
  - Chance/Wahala card deck
  - Taxes/fees
  - Bankruptcy/end conditions
  - Quick/normal mode
  - Settings: starting cash, rent rules, board size, auctions/trades toggle
- Create `games/landlord/source/` files
- Create `games/landlord/tests/runtime.test.mjs`
- **Games affected:** landlord only
- **Deliverable:** Nigerian property board game

### Phase 8 — AI Content System
**Goal:** Server-side AI content generation for applicable games.

- AI content generation module:
  - Color Wahala prompts
  - Bible Timeline events
  - Faith Feud survey packs
  - Market Price commentary
  - Logo Guesser hints
  - Who Sabi Pass questions
  - Pidgin Translator semantic scoring
  - Rule explanations, recaps, bot ranking
- Rules:
  - Server-side only, fail soft
  - No key exposure
  - Deterministic fallback required
  - Cache generated content
  - Anti-repeat memory
  - Moderation for generated content
- **Games affected:** bible-timeline, color-wahala, faith-feud, logo, trivia, market-price, pidgin-translator
- **Deliverable:** AI content generation working for all applicable games, falling back to manual banks

### Phase 9 — Game-Specific UI Components
**Goal:** Per-game display, controller, companion, crowd React components.

- Design component loading architecture (game provides its own components)
- Build per-game display components (board views, animations, reveals)
- Build per-game controller components (hand views, dice, input methods)
- Build per-game companion components (settings, timer controls, player management)
- Build per-game crowd components (watch, react, vote)
- Wire through InstalledGameSurface as component router
- Add animations, sounds, reactions per game
- **Games affected:** All 15
- **Deliverable:** Every game has its own visual identity instead of one mega-component

### Phase 10 — Integration, E2E & Deploy
**Goal:** Everything wired together, tested end-to-end, deployed.

- Update `scripts/playwright-gameplay-matrix.mjs` with game-specific assertions
- Add recovery E2E (refresh, reconnect, server restart)
- Add timer E2E (round closes, late rejections, pause/resume)
- Add team mode E2E (rotation, scoring)
- Add voice E2E (Pidgin Translator text fallback)
- Update docs/IMPLEMENTATION_PROGRESS.md with final state
- Update docs/CODEX_HANDOFF.md with architecture decisions
- Run full gate: typecheck, lint, test, build, deploy to Dell
- Run live smoke: entry, bot autofill, vote, gameplay matrix
- **Deliverable:** All 15 games working, tested, deployed, documented

## Total game test matrix (per game, per phase)

Every game must have:
- Runtime contract test
- Legal intent test (no answer leakage)
- Illegal intent rejection test
- Scoring test
- Settings validation test
- Snapshot/restore test
- Finish/recap test
- Public/private projection test
- Controller state test
- Timer test (where applicable)
- No-repeat content test (where applicable)
- Bot test (where supported)
- Team test (where supported)
- AI fallback test (where used)
