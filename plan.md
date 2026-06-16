# BoredRoom Full Product Plan

## Product Vision
BoredRoom is a browser-based social game platform for people in the same physical room.

Core experience:
- One shared display shows the public game world.
- Each person uses their phone as a private controller.
- No app install required.
- Join by QR code or room code.

Design goals:
- Fast start (under 1 minute to room-ready)
- High room energy (spectator-friendly, reactions, suspense)
- Deterministic rules and fair authority
- Scalable game suite (not a single-game app)

## Core Product Principles
- Host/display is orchestration + public state only.
- Controllers are private state + actions only.
- Host is never a playable seat.
- Clients send intents only; server validates and resolves outcomes.
- Public and private projections are strictly separated.
- Reliability before breadth: Ludo must be stable before aggressive expansion.

## Game Suite Roadmap

### 1) Ludo (v1) ✅
### 2) Whot (v1.1) ✅
### 3) Trivia — Who Sabi Pass? ✅
### 4) Connect 4 + Endless Tic Tac Toe (party-system) ✅
### 5) Logo Guesser ✅
### 6) Color Wahala (Stroop speed game) ✅
### 7) Oga Landlord (Monopoly-style) ✅
   - Auctions, mortgages, jail, trades, bankruptcy
### 8) Hustle (snakes-and-ladders + japa endgame) ✅
   - Hustle cards, market squares, snake shields, japa exits (UK/CA/US)
### 9) Word Wahala (Scrabble-style) ✅
   - Pidgin (1.5×) / indigenous (2×) tiers, Yarn Battle 30s timer, tile swap
### 10) Party bundle (bluffing/voting) — backlog

## Social Layer Plan
- Quick reactions (emoji + burst combos)
- Structured taunts with cooldowns
- Spectator role and participation boundaries
- Host moderation controls (kick/mute/toggle systems)
- Anti-spam policy (rate limits + duplicate suppression)

## AI Layer Plan
AI is assistive, never rules-authoritative.

Features:
- Live display commentary
- Private hints (controller)
- Rule explanation messages
- End-of-match recap

Safety/guardrails:
- No hidden info leakage to display
- No rule invention
- Visibility-aware prompts
- Provider fallback status surfaced in UI

## Voice Layer Plan
- LiveKit-backed optional voice
- Room voice and team voice modes
- Push-to-talk
- Active speaker indicators
- Host controls and safety limits

## Platform Services and Data
Persistent platform responsibilities:
- Accounts/profiles
- Match history
- Stats/leaderboards
- Replay metadata

Runtime responsibilities:
- Active room state
- Turn state and moderation actions
- Presence/reconnect continuity

## Technical Architecture (Current Direction)
- Web app: Vite + React + TypeScript
- Realtime authority: Colyseus server
- Shared package: contracts + deterministic rules adapters
- Auxiliary/fallback: Supabase path during migration period
- Deployment: Docker on Dell + Cloudflare HTTPS/Tunnel

## Public Interface Baseline
Stable contract target:
- `host:*` intents for moderation/admission/control
- Gameplay intents (`roll_dice`, `move_token`, `toggle_ready`, `send_reaction`)
- Hook diagnostics surface:
  - `transportKind`
  - `syncStatus`
  - `lastErrorCode`
  - `retryCount`

Versioning policy:
- Keep contracts backward-compatible by default.
- Version only when unavoidable.

## Reliability Backlog (Immediate)
- Eliminate all host/controller infinite connecting loops
- Deterministic join failure states (room missing, auth mismatch, timeout)
- Actionable recovery controls (retry/reset)
- PWA stale-client update path
- Full lifecycle smoke coverage

## Testing Strategy
1. Connection reliability
- Host and controller fresh join
- Reconnect after transient drop
- Timeout/failure path with explicit recovery UI

2. Room lifecycle
- `lobby -> playing -> finished -> lobby` repeatable
- Host not counted as seat
- Active-seat gating enforced

3. Admission/moderation parity
- approve/reject/spectator/transfer/spawn
- bot add/remove/replace/autofill
- room policy `open|approval|locked`

4. Deployment smoke
- `/`, `/host`, `/join`, `/health`
- TLS endpoint checks on public domains

## Operational Rules
- Follow `handoff-preflight.md` before any contributor/agent handoff
- Sync local state before any delegation
- Verify builds/tests before push
- Keep repo runnable after each commit
