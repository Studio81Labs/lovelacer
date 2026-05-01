#!/usr/bin/env bash
set -e

# Read add-on options from /data/options.json if available. With
# `init: false` and no s6-overlay, we parse JSON directly with jq
# rather than using bashio.
OPTIONS_FILE="/data/options.json"
if [[ -f "$OPTIONS_FILE" ]]; then
  export LOG_LEVEL="$(jq -r '.log_level // "info"' "$OPTIONS_FILE")"
  export DASHBOARD_URL_PATH="$(jq -r '.dashboard_url_path // "lovelacer-home"' "$OPTIONS_FILE")"
fi

# Supervisor injects SUPERVISOR_TOKEN automatically when the add-on
# starts. HA_URL is the canonical hostname inside the add-on network;
# home-assistant-js-websocket connects to /api/websocket on that host.
export HA_URL="http://homeassistant:8123"
export DATA_DIR="/data"

cd /app
# `exec` replaces the shell so signals (SIGTERM from Supervisor on
# stop) reach Node directly without the bash wrapper swallowing them.
exec node packages/server/dist/main.js
