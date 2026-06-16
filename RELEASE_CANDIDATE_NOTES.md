# Release Candidate Notes

## Summary

- Whot is now playable end-to-end alongside Ludo.
- AI commentary and recaps are game-aware for Ludo and Whot.
- Server persistence, reconnect paths, and production startup checks were hardened.
- Production diagnostics are available behind dev/debug mode and hidden by default.

## Verification

Run before merging/deploying this release candidate:

- `npm run lint`
- `npm run test -- --run`
- `npm run build`
- `npm --prefix server run build`
- `npm run smoke:all`
- `npm audit --omit=dev` or dependency scan

## Production smoke checklist

### Ludo

- Create `/ludo/host`.
- Join with at least two controllers.
- Ready and start the game.
- Roll and move at least one turn.
- Reconnect a controller and confirm the seat is preserved.
- Finish or simulate finish if supported.
- Confirm match history is recorded once.

### Whot

- Create `/whot/host`.
- Join with two controllers.
- Confirm private hands appear on join and reconnect.
- Verify legal highlights, invalid move feedback, pick 2/pick 3 stacking and consume, Whot 20 suit call, and Last Card enforcement.
- Confirm AI commentary is visible to non-host clients.
- Confirm recap appears on game over.
- Confirm profile history is recorded once as Whot.

### Mobile UX

- Test one iPhone-sized viewport and one Android-sized viewport.
- Check QR join flow, reachable controller buttons, Whot hand scrolling, Ludo dice/move controls, diagnostics hidden by default, and no horizontal overflow.

## Known limitations

- Git branch creation, commits, pushes, PR creation, GitHub Actions status checks, and production deployment must be completed outside this sandbox.
- `npm audit --omit=dev` is blocked by the sandbox npm audit endpoint; dependency scan currently reports no high or critical vulnerabilities.
- Manual production browser/device smoke still needs to be run against the deployed RC commit.
