# Changelog

All notable changes to BoredRoom are documented here.

## 1.3.0.1 — 2026-06-25

- Replaced the retired OpenRouter Gemini 2.0 endpoint with the verified `google/gemini-2.5-flash-lite` endpoint.

## 1.3.0.0 — 2026-06-25

- Replaced all game-specific rooms with one authoritative house-session runtime.
- Moved the 15 games into signed, independently installable plugins.
- Rebuilt desktop, tablet, mobile, lobby, controller, library, and status surfaces around the approved Lagos neon design.
- Added server-side OpenRouter commentary, hints, recommendations, explanations, recaps, moderation, health reporting, and deterministic fallbacks.
- Removed obsolete packs, operators, adapters, secondary codes, direct room APIs, old transports, and compatibility routes.
- Added durable session membership, runtime snapshots, plugin reconciliation, active-version pinning, and forward database cleanup migrations.
