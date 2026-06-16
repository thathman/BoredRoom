# BoredRoom Versioning Policy

BoredRoom is currently in pre-production beta.

## Rule

Until BoredRoom is production-ready, all release/deployment versions must use beta semver:

```txt
0.x.y-beta.n
```

Do not use `1.x.x` while the product is still being rebuilt into the pack-based platform.

## Current Phase

The project is in platform beta.

Recommended current starting version:

```txt
0.1.0-beta.0
```

## Beta Version Examples

```txt
0.1.0-beta.0  initial platform beta baseline
0.1.0-beta.1  small fixes to baseline
0.2.0-beta.0  house session foundation
0.3.0-beta.0  pack-first setup and landing
0.4.0-beta.0  public display/operator/controller split
0.5.0-beta.0  vote/request engine
0.6.0-beta.0  theme engine and design system
0.7.0-beta.0  first new pack games
0.8.0-beta.0  recovery/snapshot beta
0.9.0-beta.0  v1 release candidate track
```

## Production Versioning

Only when BoredRoom is ready for real production should the version become:

```txt
1.0.0
```

After v1, use normal semantic versioning:

```txt
MAJOR.MINOR.PATCH
```

## Release Channels

Recommended release channels:

```txt
beta       public beta / staged production beta
preview    temporary test builds
stable      production v1 and later
```

## Tag Format

Beta tags:

```txt
v0.1.0-beta.0
v0.2.0-beta.0
```

Production tags:

```txt
v1.0.0
v1.1.0
v1.1.1
```

## Deployment Rule

Production deployment is allowed during beta, but the deployed version must still identify as beta until v1.
