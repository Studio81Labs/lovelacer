# Installing the Lovelacer add-on

Phase 1a alpha — install via custom add-on repository on your own HA instance.

## Prerequisites

- HA OS or HA Supervised (the add-on store isn't available in HA Core or HA Container).
- Internet access from the HA host to `ghcr.io` (Lovelacer images live there).

## Install

1. In HA, open **Settings → Add-ons → Add-on Store**.
2. Click the **⋮** menu (top right) → **Repositories**.
3. Add `https://github.com/Studio81Labs/lovelacer` and click **Add**.
4. Close the repositories dialog. Scroll down — you'll see a **Lovelacer** section.
5. Click **Lovelacer** → **Install**. The first install pulls the multi-arch image (~50 MB compressed) for your HA host's architecture.
6. After install, click **Start**. The add-on status should turn green within ~10 seconds.
7. Click **Open Web UI** (or use the new sidebar entry) to open the SPA via Supervisor ingress.

## Configuration

The defaults work out of the box. To change them:

1. Open the add-on's **Configuration** tab.
2. Edit `log_level` (default `info`) or `dashboard_url_path` (default `lovelacer-home`).
3. Click **Save** and **Restart**.

## Updating

Lovelacer publishes two channels:

- **`latest` / `vX.Y.Z`** — tagged releases. Recommended.
- **`main` / `sha-<short>`** — bleeding edge from `main`. For our own dogfood; the add-on store always installs `latest`.

When a new tagged release is published, HA's add-on store shows an **Update available** banner. Click it to pull the new image.

## Uninstalling

1. Open the add-on, click **Uninstall**. The container is removed; the `lovelacer-home` dashboard is **not** deleted from HA — that's a separate cleanup.
2. To delete the dashboard: **Settings → Dashboards → Lovelacer — Home → ⋮ → Delete**.

## Troubleshooting

- **"Backend unreachable" in the SPA**: the Fastify server inside the add-on is starting up. Wait 10s and reload, or check **Logs** for a startup error.
- **HA shows "disconnected" in the SPA's HealthBar**: the add-on can reach the network but not HA. Usually means `SUPERVISOR_TOKEN` is missing — try restarting the add-on.
- **Apply fails with `ha_apply_failed` step `save`**: HA rejected the generated config. Often happens when an existing dashboard at the same `url_path` was modified manually. Either delete it from HA's UI first or change `dashboard_url_path`.
- **"No rooms detected"**: your HA install doesn't have areas assigned to entities, or the device / entity names don't match Lovelacer's English + Czech room patterns. Open `log_level: debug` and re-run Analyze; the add-on log shows which patterns matched what.

## Architecture summary

The add-on packages two services into one container:

- A **Fastify backend** (`@lovelacer/server`) that holds the analysis pipeline, generator, and HA WebSocket client. Listens on `:3000`.
- A **Vue 3 SPA** (`@lovelacer/web`) served as static assets by the same Fastify server. Loaded into the HA UI via Supervisor ingress.

The backend uses `SUPERVISOR_TOKEN` to talk to HA Core's WS API at `ws://homeassistant:8123/api/websocket`. No internet access is needed at runtime once the image is pulled.

For the full architecture, see `docs/ARCHITECTURE.md` in the source repo.
