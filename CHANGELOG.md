# Changelog

All notable changes to BoredRoom are documented here. This project follows
[Semantic Versioning](https://semver.org/):

- **MAJOR** (1.0.0 → 2.0.0): breaking changes — updates that break existing
  integrations or workflows.
- **MINOR** (1.1.0 → 1.2.0): new features added in a backwards-compatible manner.
- **PATCH** (1.1.1 → 1.1.2): backwards-compatible bug fixes and security patches.

## [1.1.0] - 2026-06-16 — MINOR (Whot overhaul + single source of truth)

### Added
- Major **Whot** overhaul merged from the workstation working copy: rewritten
  `whotEngine` and `WhotRoom` (pick-two/pick-three chains, suspend, general
  market, suit-call, turn timer/market-on-timeout), refreshed Whot card/
  controller/display UI, expanded contracts + transport types, new Whot tests.

### Changed
- Consolidated all copies (workstation, dell, fork) into this repo as the single
  source of truth. Resolved the workstation's uncommitted work against the clean,
  Lovable-free base (kept beta→v1, Lovable strip, deploy/CI hardening; took the
  workstation's Whot engine + bug fixes).
- Supabase client fails soft when env is missing (placeholder fallback) instead
  of throwing at import and blanking the app — fixes CI/preview builds.

### Removed
- All AI-assistant artifacts from version control (`.claude/`, `.taskmaster/`,
  `.mcp.json`, `CLAUDE.md`, `workspace.md`, `docs/agents/`); now gitignored.

## [1.0.1] - 2026-06-15 — PATCH (bug fixes + build/CI hardening)

### Fixed
- Server failed to compile: `this.game` typo in ColorWahala/Connect4/Ettt/HalfHalf/Logo
  rooms (each room's state field is `cw`/`connect4`/`ettt`/`hh`/`logo`).
- React #310 crash white-screening every room: `RoomPage` called `useReplayRecorder`
  and a `useState` after the connecting/fatal/mismatch early returns; hoisted all
  hooks above the early returns.
- React #310 crash in the Hustle controller: `useRef`/`useEffect` were called after
  the `if (!me)` early return; hoisted them above it.
- 7 failing unit tests (stale expectations + jsdom Web Storage gap) — suite now
  203/203 green. No engine logic changed; only test expectations and a storage
  polyfill in test setup.

### Changed
- Regenerated web and server lockfiles off the Lovable private cache onto
  registry.npmjs.org, enabling reproducible `npm ci` installs everywhere.
- CI now installs Playwright browsers, runs `lint` and `typecheck`, and uses
  `npm ci` for both web and server.
- Dockerfiles use `npm ci` instead of `npm install`.

### Added
- `typecheck` and `verify` (`lint && typecheck && test && build`) npm scripts.

## [1.0.0] - 2026-06-15 — initial release

### Added
- BoredRoom: browser-based same-room multiplayer party-game platform (shared
  display + phones as controllers; join by QR/room code).
- 11 games shipped out of beta into v1: Ludo, Whot, Who Sabi Pass?, Connect 4,
  Endless Tic Tac Toe, Logo Guesser, Oga Landlord, Color Wahala, Hustle, Word
  Wahala (Half & Half remains gated pending its server room).
- English + Nigerian Pidgin (pcm) localization with in-app language switcher.
- Colyseus authoritative realtime server, deterministic shared rules engines,
  Supabase-backed history/replay, AI commentary/recap scaffolding.
- Docker Compose deployment (`boredroom-web`, `boredroom-server`).

### Changed
- Forked clean from the original `game-night-hub` project with all Lovable
  references and tooling removed.
