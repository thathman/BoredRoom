# BoredRoom Milestone Roadmap

Status key:
- `[x]` Completed
- `[~]` In progress
- `[ ]` Not started

## Phase 1 — Core MVP (Reliability + Ludo)

### Outcome
A room can host and finish Ludo end-to-end with stable two-screen behavior and no transport deadlocks.

### Product + UX
- `[x]` Two-screen routes (`/host`, `/join`, `/room/:code`)
- `[x]` Host-display and controller-role split
- `[x]` QR/code join baseline
- `[~]` Deterministic failure UX (no infinite connecting)
- `[~]` PWA stale-client update prompt

### Realtime + Room Authority
- `[x]` Colyseus server authority for gameplay path
- `[x]` Host token issuance/verification
- `[x]` Host excluded from playable seats
- `[x]` Active-seat start gating
- `[~]` Reconnect continuity hardening (host + controller)

### Ludo Feature Set
- `[x]` Core rules loop (roll/move/win)
- `[x]` Display board + turn state
- `[x]` Controller action flow
- `[~]` Final turn-edge-case QA pass

### Release Gate
- `[ ]` Full smoke automation (create/join/ready/start/play/finish/play-again/reconnect)
- `[ ]` Phase 1 signoff with evidence

## Phase 2 — Social Systems + Whot

### Outcome
BoredRoom feels socially alive and supports hidden-information gameplay beyond Ludo.

### Social Layer
- `[x]` Reaction baseline
- `[x]` Taunt baseline scaffolding
- `[~]` Reaction v2 quality (burst/combo/ranking)
- `[ ]` Anti-spam/cooldown full tuning
- `[~]` Host moderation controls
- `[ ]` Spectator permissions hardening

### Admission + Bots
- `[x]` Pending join framework
- `[x]` Host approve/reject flow
- `[x]` Bot controls (add/remove/replace/autofill)
- `[~]` Idempotency + stress validation

### Whot Delivery
- `[ ]` Rules engine (deck, draw, specials, suit call)
- `[ ]` Controller private hand UI
- `[ ]` Display discard/turn UI
- `[ ]` Match persistence and recap integration

## Phase 3 — Intelligence, Voice, and Expansion

### Outcome
BoredRoom becomes a differentiated social game platform, not just a Ludo app.

### AI Layer
- `[~]` Commentary/recap scaffolding
- `[ ]` Private hint panel and visibility-safe output routing
- `[ ]` Guardrails + fallback status consistency
- `[ ]` Personality profiles (Host, Banker, Chaos MC, Naija Hype)

### Voice Layer
- `[ ]` LiveKit integration
- `[ ]` Room/team voice modes
- `[ ]` Active speaker + host controls

### Game Expansion
- `[x]` Logo Guesser
- `[x]` Color Wahala
- `[x]` Connect 4 (party-system migration)
- `[x]` Endless Tic Tac Toe (party-system migration)
- `[x]` Trivia (Who Sabi Pass?)
- `[x]` Oga Landlord (Monopoly-style: auctions, mortgages, jail, trades, bankruptcy)
- `[x]` Hustle (snakes-and-ladders + japa endgame + hustle cards)
- `[x]` Word Wahala (Scrabble-style: Pidgin/indigenous tiers, Yarn Battle 30s timer, swap)
- `[ ]` Party bundle (bluffing/voting)

## Cross-Phase Platform Work

### Persistence + Platform API
- `[ ]` Full history/stats leaderboard model completion
- `[ ]` Replay-ready event indexing
- `[ ]` Moderation event persistence

### Ops and Deployment
- `[x]` Docker deployment on Dell
- `[x]` Cloudflare TLS endpoint baseline
- `[ ]` Monitoring/alerting baseline
- `[ ]` Load testing + backup/restore drills
- `[ ]` Coolify transition plan execution (deferred)

## Current Active Sprint

### Sprint A (Blockers)
- `[~]` Eliminate host/controller connecting loops
- `[~]` Transport diagnostics + retry/reset UX
- `[~]` Deterministic fatal join-state UX
- `[~]` PWA stale client recovery path

### Sprint B (Phase 1 closeout)
- `[ ]` Complete reconnect regression matrix
- `[ ]` Complete room-policy parity checks in all states
- `[ ]` Run repeated end-to-end smoke cycles
- `[ ]` Mark Phase 1 complete
