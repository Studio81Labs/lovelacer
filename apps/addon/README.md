# Lovelacer

Generate a Home Assistant Lovelace dashboard from your existing entities.

## What it does

1. Click **Analyze** — Lovelacer reads your HA entity, device, and area registries and detects rooms across 8 languages.
2. Review the preview. Re-run **Analyze** any time; the diff view shows what moved, what was added, and what was removed.
3. Adjust per-entity overrides if needed, accept smart suggestions with one click, then click **Apply**.

The dashboard is a regular HA dashboard — you can edit, copy, or delete it from HA's UI like any other.

## Configuration

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

All add-on state (overrides, applied snapshots, settings, onboarding completion) lives in the add-on's `/data` volume — nothing leaves the HA host.

## Status

Phase 2 alpha. Multi-language room detection (EN / CS / DE / ES / FR / IT / PL / NL). Re-analyze diff view shows what changed since the last apply. Per-entity overrides + smart suggestions panel. Settings UI for language and dashboard sections. Onboarding wizard for first-run.

The single honest constraint: custom Lovelace cards (Mushroom, Tile-extras) are not generated — pure HA core cards only.

## Source + reporting bugs

- Source: <https://github.com/Studio81Labs/lovelacer>
- Bug reports: <https://github.com/Studio81Labs/lovelacer/issues>
- Architecture + design docs: see `docs/` in the source repo.
