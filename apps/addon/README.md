# Lovelacer

Generate a Home Assistant Lovelace dashboard from your existing entities.

## What it does

1. Click **Analyze** — Lovelacer reads your HA entity, device, and area registries.
2. See a list of detected rooms with entity counts and confidence summaries.
3. Click **Apply** — Lovelacer generates a `lovelacer-home` Lovelace dashboard and pushes it to HA via the storage-mode WebSocket.

The dashboard is a regular HA dashboard you can edit, copy, or delete from HA's UI like any other.

## Configuration

Two options:

| Key                  | Default          | Notes                                                                                                                                                   |
| -------------------- | ---------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `log_level`          | `info`           | One of `trace, debug, info, warn, error, fatal`. Set `debug` to see why entities did or didn't get classified into a room.                              |
| `dashboard_url_path` | `lovelacer-home` | The `url_path` segment HA uses for the generated dashboard. Lower-case alphanumeric + hyphens. Change if you want a different URL or a second instance. |

## Logs

The add-on writes Pino-formatted JSON to stdout. View them in **Settings → Add-ons → Lovelacer → Logs**.

## Privacy + scope

Lovelacer reads your HA registries and writes a single Lovelace dashboard back. It doesn't:

- Send any data outside your HA instance.
- Modify your existing automations, scripts, or other dashboards.
- Persist anything to disk yet (Phase 1a). The `/data` volume is mounted but unused.

## Status

This is **Phase 1a alpha**. Things you should know:

- Only English + Czech room name patterns are supported. German lands in 1b.
- Only light, switch, sensor (temperature/humidity), binary_sensor (motion/occupancy/door), and climate entities get proper card mapping. Everything else lands in a generic "Other" view.
- No drag-and-drop. No per-entity overrides. No diff against existing dashboards.

## Source + reporting bugs

- Source: <https://github.com/Studio81Labs/lovelacer>
- Bug reports: <https://github.com/Studio81Labs/lovelacer/issues>
- Architecture + design docs: see `docs/` in the source repo.
