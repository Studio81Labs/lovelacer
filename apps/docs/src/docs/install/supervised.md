# Install on Home Assistant Supervised

Public v1.0.0 release installs through a custom add-on repository on your own Home Assistant instance.

Use this path for Home Assistant OS or Home Assistant Supervised. The add-on store is not available in Home Assistant Core or Home Assistant Container, so those installs should use the standalone Docker guide.

## Prerequisites

- Home Assistant OS or Home Assistant Supervised.
- Network access from the Home Assistant host to `ghcr.io`.
- Permission to add custom add-on repositories.

## Add the repository

1. Open Home Assistant.
2. Go to **Settings > Add-ons > Add-on Store**.
3. Open the menu in the top right and choose **Repositories**.
4. Add this repository:

```text
https://github.com/Studio81Labs/lovelacer
```

5. Close the repositories dialog and wait for the store to refresh.

## Install and start

1. Open the **Lovelacer** add-on card.
2. Click **Install**.
3. Click **Start**.
4. Click **Open Web UI** or use the sidebar entry.
5. Follow the first-run wizard to analyze, preview, and apply a dashboard.

The add-on uses Home Assistant Supervisor ingress, so users do not need to expose an extra port. Runtime Home Assistant access goes through Supervisor's Core proxy: REST traffic uses `http://supervisor/core/api`, WebSocket traffic uses `ws://supervisor/core/websocket`, and `SUPERVISOR_TOKEN` is sent through that proxy. The add-on should not call `homeassistant:8123` directly.

## Configuration

The defaults are intended to work on first start. The add-on exposes these options:

| Option               | Default          | Purpose                                                              |
| -------------------- | ---------------- | -------------------------------------------------------------------- |
| `log_level`          | `info`           | Controls server logging in the add-on log view.                      |
| `dashboard_url_path` | `lovelacer-home` | Sets the Home Assistant dashboard path Lovelacer creates or updates. |

After changing options, save and restart the add-on.

## Updating

The add-on store shows an update banner after a tagged release is available. Install the update from Home Assistant and restart the add-on when prompted.

## Uninstalling

Uninstalling the add-on removes the Lovelacer container and its local state. It does not delete the Home Assistant dashboard that Lovelacer created. To remove that dashboard, go to **Settings > Dashboards**, open the Lovelacer dashboard menu, and delete it there.

## Troubleshooting

| Symptom                                    | What to check                                                                                                                                                                        |
| ------------------------------------------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| The web UI says the backend is unreachable | Wait a few seconds and reload. If it continues, open the add-on logs and check for startup errors.                                                                                   |
| Home Assistant shows as disconnected       | Restart the add-on. In add-on mode the server authenticates with `SUPERVISOR_TOKEN` through the Supervisor Core proxy; check that the add-on started with `homeassistant_api: true`. |
| Apply fails while saving                   | Delete or rename an existing dashboard at the same URL path, or change `dashboard_url_path` and try again.                                                                           |
| No rooms are detected                      | Assign areas in Home Assistant or use Lovelacer overrides after analysis. Debug logs show which signals matched.                                                                     |
