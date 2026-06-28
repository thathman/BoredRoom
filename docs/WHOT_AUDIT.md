# Whot completion audit

Date: 2026-06-28  
Target release: BoredRoom `1.9.0.0`, BoredRoom-Games `1.6.0.0`

## Rule engine

- Full 54-card deck and private hands are server-authoritative.
- Classic default deal is six cards; four- and five-card house deals are selectable.
- Match by shape/number and Whot 20 shape requests are enforced.
- Hold On, Pick Two, Pick Three, Suspension, Star 8, General Market, optional Reverse, draw-pile recycling, and exact house-rule settings are implemented.
- Pick requests can require the same rank, accept either pick rank, or disallow defence.
- Special-card finishes can be allowed or blocked without incorrectly blocking ordinary cards when effects are disabled.
- Semi-last-card, last-card, and check-up calls are automatic.
- Five rounds are available; the first player to three round wins takes the game. Starting player rotates each round by default.
- Bots use only legal server intents and choose a requested shape from their remaining hand instead of always calling Circle.
- Snapshots retain hands, draw/discard piles, settings, direction, scores, callouts, and recycle state.

## Host, controller, and companion

- Host display shows the oval table, requested shape, pick stack, direction, round/match score, callouts, confetti, commentary, and voice announcements without exposing hands.
- Controllers show only their own hand and legal actions, with safe-area spacing, portrait guard, visible pause, requested shape, human-readable errors, and a private assistant bubble.
- A connected companion takes over game controls; the public display no longer exposes next-round controls. The companion shows the same locked Whot house rules as the host drawer.
- Sound mute/volume controls are available to host, companion, and controllers; the first user gesture unlocks browser audio.

## Source and architecture

- Rules were validated against [mykeels/whot](https://github.com/mykeels/whot) and [mykeels/whot-server](https://github.com/mykeels/whot-server), both MIT-licensed.
- Retired `WhotRoom`, duplicate rule engine, and duplicate React screens were removed from the game package. `HouseSessionRoom` and the installed `WhotRuntime` are the only executable rule path.
- Public state contains no hand/card IDs from another player. AI hints receive only the requesting controller projection and server-generated legal intents.

## Verification gates

- Runtime unit/contract tests cover deck composition, deal size, legal and illegal play, all special cards and variants, shape calls, scoring, five-round flow, timeouts, bots, snapshots, restore, private-state isolation, and readable rejection behavior.
- Browser flow covers timer pause/resume, timeout penalty, on-demand join QR, companion-aware host chrome, controller pause/assistant/isolation, and Android landscape guard.
- Physical-device speaker volume and browser-specific autoplay behavior still require a final iPhone/Android spot check after deployment; gameplay does not depend on audio.

## Optional future formats, not gaps in the selected rules

- Tournament elimination based on cumulative penalty points.
- Manual call/challenge penalties instead of automatic semi-last/last/check-up calls.
- Multiple decks for very large tables.
- Draw-and-play market variants.

These are intentionally excluded from the current best-of-five house format.
