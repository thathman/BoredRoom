# Handoff Preflight Checklist

Run this before any contributor or agent handoff:

1. `git fetch origin --prune`
2. `git pull --rebase origin main`
3. Confirm clean state: `git status --short --branch`
4. Review latest commits: `git log --oneline -n 10`
5. Draft and send handoff instructions from this exact state
6. Verify returned work (build/tests/smoke)
7. Push only verified changes to `origin/main`

Rules:

- Never hand off from stale local state.
- Never push unverified runtime changes.
- Keep contributor/agent scopes non-overlapping when running in parallel.
- For CI verification refresh, allow no-op docs commit to retrigger checks.

## PWA Stale-Client Verification (post-deploy)

Run this on at least one installed PWA device after every deploy that ships client-side changes:

1. Note the deployed build hash from CI/commit (should match the `build <sha>` chip on `/room/:code`).
2. On a phone that already has BoredRoom installed as a PWA, foreground the app (do not reinstall).
3. Navigate to any route (`/`, `/join`, `/host`). Within a few seconds, a "New version available" toast should appear.
4. Tap Update. The page should reload and the build-hash chip (visible on the controller and host room views) should reflect the new short SHA.
5. If the toast never appears: check service-worker status in browser devtools → Application → Service Workers → confirm `sw.js` is controlling the page and the build hash on the loaded bundle matches the latest deploy.

If devices consistently serve stale bundles after a deploy, capture the build hash + deploy SHA in the bug report so the drift is measurable. Do not call a deploy good until at least one installed PWA device has rolled forward.
