# Claude Operating Instructions for BoredRoom

This is the implementation repository for BoredRoom.

Spec/control repository:

```txt
https://github.com/thathman/BoredRoom-Spec
```

Implementation repository:

```txt
https://github.com/thathman/BoredRoom
```

## Mission

Continuously build BoredRoom from the private spec kit into a pack-based, session-aware, multi-screen game-night platform.

## Operating Model

1. Pull/read the latest planning specs from `thathman/BoredRoom-Spec`.
2. Implement only in this repo: `thathman/BoredRoom`.
3. Build sequentially, phase by phase.
4. Keep existing games working while platform systems are introduced.
5. Run verification before any push.
6. Push production deployments only as beta releases until the product is ready for v1.

## Required Verification

Before proposing or pushing a change, run:

```bash
npm run verify
```

If that is too heavy for a narrow change, run the smallest relevant subset and document what was not run.

## Product Direction

BoredRoom is becoming:

> A pack-based, session-aware, multi-screen game-night platform.

Product line:

> Pick a pack. Gather the room. Let the house play.

## Non-Negotiables

- `HouseSession` is the true persistence layer.
- `GameRun` is one play instance under a house session.
- Colyseus rooms are realtime containers, not the full game-night state.
- Public display must not expose private player state.
- Operator console controls settings and flow separately from public display.
- Controllers persist across games and sessions.
- AI never mutates game state directly.
- Server validates every game action.
- Rematches create new `game_run_id` values.
- Host display should not require scrolling during normal play.
- Use beta versioning until production v1.

## Beta Versioning Rule

Until the product is ready for true production v1, all released/deployed versions must use pre-1.0 beta semver:

```txt
0.x.y-beta.n
```

Examples:

```txt
0.1.0-beta.0
0.1.0-beta.1
0.2.0-beta.0
0.3.0-beta.2
```

When the product is production-ready, cut:

```txt
1.0.0
```

After that, use normal semver.
