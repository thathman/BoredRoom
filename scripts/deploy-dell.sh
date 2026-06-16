#!/usr/bin/env bash
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TARGET_HOST="${TARGET_HOST:-dell}"
TARGET_DIR="${TARGET_DIR:-/home/hendrix/boredroom_sync}"

if [[ "${DRY_RUN:-0}" == "1" ]]; then
  echo "[deploy] DRY_RUN enabled"
  echo "[deploy] Would run: git -C \"$ROOT_DIR\" push origin main"
  echo "[deploy] Would sync archive to ${TARGET_HOST}:${TARGET_DIR}"
  echo "[deploy] Would run docker compose up -d --build and health checks"
  exit 0
fi

echo "[deploy] pushing main to origin"
git -C "$ROOT_DIR" push origin main

echo "[deploy] syncing repository archive to ${TARGET_HOST}:${TARGET_DIR}"
git -C "$ROOT_DIR" archive --format=tar HEAD \
  | ssh "$TARGET_HOST" "mkdir -p '$TARGET_DIR' && tar -xf - -C '$TARGET_DIR'"

echo "[deploy] building + restarting stack on ${TARGET_HOST}"
ssh "$TARGET_HOST" "cd '$TARGET_DIR' && docker compose build && docker compose up -d"

echo "[deploy] waiting for /healthz"
ssh "$TARGET_HOST" "for i in {1..30}; do curl -fsS http://127.0.0.1:2567/healthz >/dev/null && exit 0; sleep 2; done; exit 1"

echo "[deploy] deployment successful"
