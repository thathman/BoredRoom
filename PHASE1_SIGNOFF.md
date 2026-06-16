# Phase 1 Signoff (Draft)

## Scope
Phase 1 goal: reliable two-screen Ludo loop in production with stable room lifecycle and reconnect behavior.

## Shipped
- Two-screen route/model split (`/host`, `/join`, `/room/:code`).
- Colyseus authoritative realtime server and host-token join validation.
- Host-not-a-seat invariants and active-seat start gating.
- Room lifecycle path `lobby -> playing -> finished -> lobby`.
- Mid-game admission flow + bot management baseline.
- Transport diagnostics and deterministic failure recovery surfaces in room UI.
- PWA update prompt baseline for stale client bundles.
- Docker deployment on Dell + Cloudflare TLS endpoints.

## Evidence
- Unit tests pass (`npm run test`).
- Web/server builds pass (`npm run build`, `npm --prefix server run build`).
- Smoke scripts present and runnable:
  - `npm run smoke:e2e`
  - `npm run smoke:policy`
  - `npm run smoke:reconnect`
  - `npm run smoke:all`
- CI workflow enforces build + tests + smoke suite on PRs to main.

## Deferred to Phase 2+
- Reactions v2 polish (burst/combo/ranking + anti-spam tuning).
- Whot playable implementation.
- Voice layer integration.
- AI layer expansion beyond current scaffolding.
- Additional game modules (Scrabble, Monopoly-style, party bundle).

## Remaining Phase 1 Checkbox (Manual)
- Installed PWA device verification (iOS + Android):
  - Confirm update toast appears after deploy.
  - Confirm build/version hash chip updates to latest commit.
  - Confirm reconnect loop is absent on installed app path.

When this manual checkbox is verified, Phase 1 can be marked complete.
