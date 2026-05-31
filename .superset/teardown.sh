#!/usr/bin/env bash
# Superset workspace teardown for Lovelacer.
#
# Only stops the local Home Assistant dev stack if THIS workspace started it
# (via ./.superset/ha.sh up, which leaves a marker). The HA container is shared
# across the main repo and worktrees — a blanket `docker compose down` here
# would otherwise stop a container another checkout is relying on.
set -euo pipefail

marker=".superset/.ha-started"

if [ -f "$marker" ]; then
  docker compose -f dev/ha-stack.yml down
  rm -f "$marker"
fi
