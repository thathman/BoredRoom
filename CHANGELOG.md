# Changelog

All notable changes to BoredRoom are documented here.

## 1.6.0.0 — 2026-06-27

- Added display-side vote dismissal and current-game pause, resume, and end controls.
- Removed public game boards from Ludo and Whot controllers.
- Fixed companion pairing feedback and clarified the six-digit code flow.
- Allowed the owner-control header through CORS preflight so pairing and AI health calls reach the server.
- Added persisted cross-game championship standings.
- Added mixed Nigerian YarnGPT callouts for Whot and removed the persistent wake-lock notice.
- Removed the homepage game shelf and made the setup Games row open the Games Library.
- Fixed duplicate service-worker registration so installed PWAs show one reliable update prompt.

## 1.3.0.1 — 2026-06-25

- Replaced the retired OpenRouter Gemini 2.0 endpoint with the verified `google/gemini-2.5-flash-lite` endpoint.

## 1.3.0.0 — 2026-06-25

- Replaced all game-specific rooms with one authoritative house-session runtime.
- Moved the 15 games into signed, independently installable plugins.
- Rebuilt desktop, tablet, mobile, lobby, controller, library, and status surfaces around the approved Lagos neon design.
- Added server-side OpenRouter commentary, hints, recommendations, explanations, recaps, moderation, health reporting, and deterministic fallbacks.
- Removed obsolete packs, operators, adapters, secondary codes, direct room APIs, old transports, and compatibility routes.
- Added durable session membership, runtime snapshots, plugin reconciliation, active-version pinning, and forward database cleanup migrations.
