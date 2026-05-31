#!/usr/bin/env bash
# Superset workspace setup for Lovelacer.
# Installs workspace deps and seeds a local .env.
set -euo pipefail

# Install all pnpm workspace dependencies (frozen lockfile for reproducibility).
corepack enable >/dev/null 2>&1 || true
pnpm install --frozen-lockfile

# Seed .env: prefer the root repo's .env (carries HA_TOKEN etc.), else fall back
# to the committed example so the server has sane defaults.
if [ ! -f .env ]; then
  if [ -n "${SUPERSET_ROOT_PATH:-}" ] && [ -f "$SUPERSET_ROOT_PATH/.env" ]; then
    cp "$SUPERSET_ROOT_PATH/.env" .env
    echo "Copied .env from root repo."
  else
    cp .env.example .env
    echo "No root .env found; copied .env.example. Fill in HA_TOKEN before running."
  fi
fi
