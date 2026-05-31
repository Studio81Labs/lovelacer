#!/usr/bin/env bash
# Superset workspace teardown for Lovelacer.
#
# Only stops the local Home Assistant dev stack if THIS workspace started it and
# still owns the running container. The HA container is shared across the main
# repo and worktrees — a blanket `docker compose down` here would otherwise stop
# a container another checkout is relying on. Ownership (including stale-marker
# revalidation) lives in ha.sh down, which we delegate to so the logic stays in
# one place.
set -euo pipefail

marker=".superset/.ha-started"

if [ -f "$marker" ]; then
  ./.superset/ha.sh down
fi
