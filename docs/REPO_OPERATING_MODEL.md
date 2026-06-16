# Repository Operating Model

## Repository Roles

### Spec / Planning Repo

```txt
https://github.com/thathman/BoredRoom-Spec
```

Purpose:

- product strategy
- architecture specs
- UX flows
- game pack specs
- design system direction
- Claude prompts
- implementation roadmap
- acceptance criteria

### Implementation Repo

```txt
https://github.com/thathman/BoredRoom
```

Purpose:

- application code
- server code
- game engines
- UI implementation
- tests
- production beta deployments
- release tags

## Agent Workflow

Claude or any AI build agent should:

1. Pull/read the latest `BoredRoom-Spec` docs.
2. Pull the latest `BoredRoom` implementation repo into the workspace.
3. Select the next roadmap task from the spec repo.
4. Implement inside `BoredRoom` only.
5. Run verification.
6. Commit with clear phase/task naming.
7. Keep releases beta until v1.

## Branching Recommendation

```txt
main                     protected beta baseline
feature/house-session    feature work
feature/pack-system      feature work
feature/controller-shell feature work
release/beta             optional release prep branch
```

## Commit Style

Use clear commits:

```txt
feat(session): add house session model
feat(packs): add pack manifest registry
feat(controller): add controller shell
fix(room): preserve host token across reconnect
chore(version): set beta version baseline
```

## Build Rule

Before pushing meaningful implementation changes:

```bash
npm run verify
```

If full verify fails or is too heavy, run the relevant subset and document why.

## Release Rule

Do not publish `1.x.x` versions until production v1.

Use:

```txt
0.x.y-beta.n
```

until v1.
