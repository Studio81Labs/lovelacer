#!/usr/bin/env bash
# Workspace-aware control for the local Home Assistant dev stack.
#
# The HA dev container is a singleton: dev/ha-stack.yml hardcodes
# container_name: lovelacer-dev-ha and binds port 8123, so only one instance
# can run across the main repo and all worktrees. Use this wrapper instead of
# `pnpm dev:ha` inside a Superset workspace so teardown only stops the stack
# this workspace actually started (tracked via a workspace-local marker).
#
#   ./.superset/ha.sh up     # start HA + record ownership
#   ./.superset/ha.sh down   # stop HA + clear ownership
#
# `down` refuses to act unless this workspace owns the marker, so it can't stop
# a container the main repo or another workspace started. To force-stop the
# shared stack from any checkout, use `pnpm dev:ha:down` directly.
set -euo pipefail

marker=".superset/.ha-started"

case "${1:-}" in
  up)
    if docker ps --format '{{.Names}}' | grep -qx lovelacer-dev-ha; then
      echo "HA (lovelacer-dev-ha) is already running — started by another checkout." >&2
      echo "Leaving it untouched and not claiming ownership from this workspace." >&2
      exit 0
    fi
    # A fresh per-worktree dev/ha-config means a brand-new HA with its own
    # onboarding — any HA_TOKEN copied from the root .env won't authenticate.
    fresh=0
    [ -e dev/ha-config/.storage ] || fresh=1
    docker compose -f dev/ha-stack.yml up -d
    touch "$marker"
    if [ "$fresh" -eq 1 ]; then
      echo "Started a fresh HA instance (empty dev/ha-config) on http://localhost:8123." >&2
      echo "Any HA_TOKEN copied from the root .env will NOT work against it —" >&2
      echo "onboard, generate a new long-lived token, and set HA_TOKEN in .env." >&2
    fi
    ;;
  down)
    if [ ! -f "$marker" ]; then
      echo "This workspace did not start HA (no $marker); refusing to stop the shared stack." >&2
      echo "Use 'pnpm dev:ha:down' if you really want to stop it." >&2
      exit 0
    fi
    docker compose -f dev/ha-stack.yml down
    rm -f "$marker"
    ;;
  *)
    echo "usage: $0 up|down" >&2
    exit 1
    ;;
esac
