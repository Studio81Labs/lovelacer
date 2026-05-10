#!/bin/sh
set -e

# POSIX sh, not bash: Alpine ships ash (BusyBox) at /bin/sh and we don't
# install bash. With `init: false` and no s6-overlay, we parse JSON
# directly with jq rather than using bashio.
OPTIONS_FILE="/data/options.json"
if [ -f "$OPTIONS_FILE" ]; then
  export LOG_LEVEL="$(jq -r '.log_level // "info"' "$OPTIONS_FILE")"
  export DASHBOARD_URL_PATH="$(jq -r '.dashboard_url_path // "lovelacer-home"' "$OPTIONS_FILE")"
  export DEBUG_BACKEND_TOKEN="$(jq -r '.debug_backend_token // ""' "$OPTIONS_FILE")"
fi

# Supervisor injects SUPERVISOR_TOKEN automatically when the add-on starts.
# With `homeassistant_api: true`, HA Core API and websocket traffic must use
# the Supervisor proxy endpoints with SUPERVISOR_TOKEN as bearer/password.
export HA_URL="http://supervisor/core/api"
export HA_WEBSOCKET_URL="ws://supervisor/core/websocket"
export DATA_DIR="/data"
# Static SPA assets are baked into /app/web-dist/ by the Dockerfile so
# Fastify's @fastify/static serves them at /. Server reads this from
# WEB_DIST_DIR via packages/server/src/config.ts.
export WEB_DIST_DIR="/app/web-dist"
if [ -f /app/addon-config.yaml ]; then
  export ADDON_VERSION="$(awk -F"'" '/^version:/ { print $2; exit }' /app/addon-config.yaml)"
fi
export ADDON_VERSION="${ADDON_VERSION:-unknown}"

cd /app
# `exec` replaces the shell so signals (SIGTERM from Supervisor on
# stop) reach Node directly without the shell wrapper swallowing them.
# The pre-staged bundle has dist/ at the root (pnpm deploy flattens
# the workspace package), not packages/server/dist/.
exec node --expose-gc dist/main.js
