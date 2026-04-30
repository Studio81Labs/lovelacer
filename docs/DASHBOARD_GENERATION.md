# Dashboard Generation — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27

How the analyzer's output becomes a Lovelace dashboard.

## Output format

Both modes produce the same logical structure; only the serialization differs.

| Mode                  | Format                                    | Used for                |
| --------------------- | ----------------------------------------- | ----------------------- |
| **Storage** (default) | JSON via `lovelace/config/save` WebSocket | Apply to HA             |
| **YAML**              | `ui-lovelace.yaml`-compatible YAML string | Export, version control |

The generator emits a TypeScript object (the canonical representation), then serializes either way.

## View layout strategy

Lovelacer generates a multi-view dashboard using **Sections view** as the layout primitive (HA 2024.3+, current default for new dashboards).

### View list

| Order | View                  | Title       | Path             | Always present?          |
| ----- | --------------------- | ----------- | ---------------- | ------------------------ |
| 1     | Overview              | Home        | `home`           | ✅                       |
| 2..N  | One per detected room | (room name) | (slugified room) | If room has ≥1 entity    |
| N+1   | Misc                  | Other       | `other`          | If misc bucket non-empty |
| N+2   | Settings              | Settings    | `settings`       | Optional, off by default |

### Why Sections, not Views

The legacy "Views" layout uses fixed-column cards which look dated and don't scale across screen sizes. Sections is a CSS Grid layout where each section is a coherent group of cards, and the user can drag to reorganize. This matches modern HA dashboards (Mushroom-built homes, official examples) and degrades better on narrow screens.

YAML mode users who explicitly set `mode: panel` or want classic views can change `layout_mode` in Add-on options.

## Per-domain card mapping

For each room view, entities are grouped by domain and rendered with the most appropriate core card.

| Domain                         | State                                                           | Card                                                            | Notes                               |
| ------------------------------ | --------------------------------------------------------------- | --------------------------------------------------------------- | ----------------------------------- |
| `light`                        | any                                                             | `tile` with `vertical: false`, brightness slider via `features` | One tile per light, sorted by name  |
| `switch` (outlet device_class) | any                                                             | `tile`                                                          | Same as light                       |
| `switch` (other)               | any                                                             | `tile`                                                          | Same as light                       |
| `climate`                      | any                                                             | `thermostat`                                                    | One per entity                      |
| `cover`                        | any                                                             | `tile` with open/close `features`                               | One tile per                        |
| `media_player`                 | any                                                             | `media-control`                                                 | One per                             |
| `lock`                         | any                                                             | `tile`                                                          | One per                             |
| `camera`                       | any                                                             | `picture-entity` with `camera_view: live`                       | Larger, full-width                  |
| `vacuum`                       | any                                                             | `tile`                                                          |                                     |
| `fan`                          | any                                                             | `tile` with speed `features`                                    |                                     |
| `binary_sensor`                | `device_class: motion / occupancy / door / window`              | grouped `entities` card titled "Activity"                       | Combined into one card, not one per |
| `sensor`                       | `device_class: temperature / humidity / illuminance / pressure` | grouped `entities` card titled "Environment"                    |                                     |
| `sensor` (energy)              | `device_class: energy / power`                                  | grouped `entities` card titled "Energy"                         | Only if room has any                |
| `scene`                        | any                                                             | `tile`                                                          |                                     |
| `script`                       | any                                                             | `tile`                                                          |                                     |
| Other / fallback               | —                                                               | `entities`                                                      | One generic card                    |

### Section composition within a room

Each room view contains one **section per group**, in this order:

1. Lights & Outlets
2. Climate
3. Covers
4. Media
5. Cameras
6. Activity (binary sensors)
7. Environment (sensors)
8. Security (locks)
9. Other

Empty groups are skipped. Each section gets a heading.

## The Home overview view

A dashboard's first view is the most important; it's what users see when they tap home. Lovelacer generates an opinionated overview:

### Sections

1. **Welcome** — `markdown` card with greeting and current weather (if `weather.*` entity present)
2. **Quick stats** — `glance` card with key sensors: outdoor temp, indoor temp avg, energy now, anyone home
3. **People** — `tile` cards for each `person.*`
4. **Active rooms** — `tile` cards for rooms with anything currently on (lights on, motion detected) — uses `auto-entities` if available, otherwise static
5. **Scenes** — buttons for the top scenes (heuristic: scenes that don't include "test" / "setup")
6. **Cameras** — small grid of camera previews

Configurable: each section can be disabled in Add-on options.

## Example output (storage-mode JSON, abbreviated)

For a fixture install with 4 rooms (Kitchen, Living Room, Bedroom, Office):

```json
{
  "title": "Lovelacer — Home",
  "views": [
    {
      "title": "Home",
      "path": "home",
      "icon": "mdi:home-variant",
      "type": "sections",
      "sections": [
        {
          "type": "grid",
          "cards": [
            {
              "type": "markdown",
              "content": "## Good {{ now().strftime('%H')|int < 12 and 'morning' or 'evening' }}\n\n{{ states('weather.home') }} · {{ state_attr('weather.home', 'temperature') }}°"
            }
          ]
        },
        {
          "type": "grid",
          "cards": [
            {
              "type": "glance",
              "title": "Quick stats",
              "entities": [
                "sensor.outdoor_temperature",
                "sensor.indoor_temperature_average",
                "sensor.power_now",
                "binary_sensor.anyone_home"
              ]
            }
          ]
        }
      ]
    },
    {
      "title": "Kitchen",
      "path": "kitchen",
      "icon": "mdi:silverware-fork-knife",
      "type": "sections",
      "sections": [
        {
          "type": "grid",
          "cards": [
            { "type": "heading", "heading": "Lights" },
            {
              "type": "tile",
              "entity": "light.kitchen_ceiling",
              "features": [{ "type": "light-brightness" }]
            },
            { "type": "tile", "entity": "light.kitchen_counter" }
          ]
        },
        {
          "type": "grid",
          "cards": [
            { "type": "heading", "heading": "Environment" },
            {
              "type": "entities",
              "entities": ["sensor.kitchen_temperature", "sensor.kitchen_humidity"]
            }
          ]
        }
      ]
    }
  ]
}
```

The generator writes this via `lovelace/config/save`:

```json
{
  "type": "lovelace/config/save",
  "url_path": "lovelacer-home",
  "config": {
    /* the above */
  }
}
```

## Example output (YAML mode, equivalent)

```yaml
title: Lovelacer — Home
views:
  - title: Home
    path: home
    icon: mdi:home-variant
    type: sections
    sections:
      - type: grid
        cards:
          - type: markdown
            content: |
              ## Good {{ now().strftime('%H')|int < 12 and 'morning' or 'evening' }}

              {{ states('weather.home') }} · {{ state_attr('weather.home', 'temperature') }}°
      - type: grid
        cards:
          - type: glance
            title: Quick stats
            entities:
              - sensor.outdoor_temperature
              - sensor.indoor_temperature_average
              - sensor.power_now
              - binary_sensor.anyone_home

  - title: Kitchen
    path: kitchen
    icon: mdi:silverware-fork-knife
    type: sections
    sections:
      - type: grid
        cards:
          - type: heading
            heading: Lights
          - type: tile
            entity: light.kitchen_ceiling
            features:
              - type: light-brightness
          - type: tile
            entity: light.kitchen_counter
      - type: grid
        cards:
          - type: heading
            heading: Environment
          - type: entities
            entities:
              - sensor.kitchen_temperature
              - sensor.kitchen_humidity
```

## Icon selection

Each generated view gets a sensible icon based on canonical room ID:

| Room              | Icon                        |
| ----------------- | --------------------------- |
| `home` (overview) | `mdi:home-variant`          |
| `kitchen`         | `mdi:silverware-fork-knife` |
| `living_room`     | `mdi:sofa`                  |
| `bedroom`         | `mdi:bed`                   |
| `bathroom`        | `mdi:shower-head`           |
| `office`          | `mdi:desk`                  |
| `garage`          | `mdi:garage-variant`        |
| `garden`          | `mdi:flower-tulip`          |
| `dining_room`     | `mdi:silverware`            |
| `laundry`         | `mdi:washing-machine`       |
| `basement`        | `mdi:stairs-down`           |
| `attic`           | `mdi:home-roof`             |
| `kids_room`       | `mdi:teddy-bear`            |
| `guest_room`      | `mdi:bed-empty`             |
| `hallway`         | `mdi:door`                  |
| `other` (misc)    | `mdi:dots-horizontal`       |

## Sort orders

Within each card list, entities are sorted by:

1. Friendly name ascending
2. Tiebreaker: `entity_id` ascending

Within rooms in the sidebar:

1. Detected floor (if any)
2. Number of entities (descending — the most-active rooms first)
3. Room name ascending

## Card pack: Core (MVP) vs Mushroom (later)

### Core card pack (MVP, no dependencies)

Uses only HA's built-in cards: `tile`, `entities`, `glance`, `thermostat`, `media-control`, `picture-entity`, `markdown`, `heading`. Works on a stock HA install with zero external resources.

### Mushroom card pack (future, opt-in)

If user opts in via Add-on option `card_pack: mushroom`, the generator outputs Mushroom equivalents:

| Core                         | Mushroom                     |
| ---------------------------- | ---------------------------- |
| `tile` (light)               | `mushroom-light-card`        |
| `tile` (cover)               | `mushroom-cover-card`        |
| `tile` (lock)                | `mushroom-lock-card`         |
| `media-control`              | `mushroom-media-player-card` |
| `entities` (climate context) | `mushroom-climate-card`      |
| `glance`                     | `mushroom-chips-card`        |

Lovelacer detects whether Mushroom is installed via the `lovelace_resources` API. If user opts in but Mushroom isn't present, we surface a clear error and offer to install or revert to core.

## Storage-mode apply mechanics

```typescript
async function applyDashboard(config: LovelaceConfig, options: ApplyOptions) {
  const urlPath = options.dashboardUrlPath // e.g. 'lovelacer-home'

  // 1. Check if our dashboard already exists
  const dashboards = await ha.send({ type: 'lovelace/dashboards/list' })
  const existing = dashboards.find((d) => d.url_path === urlPath)

  // 2. Create if needed
  if (!existing) {
    await ha.send({
      type: 'lovelace/dashboards/create',
      url_path: urlPath,
      title: options.dashboardTitle,
      icon: 'mdi:home-variant',
      show_in_sidebar: true,
      require_admin: false,
      mode: 'storage',
    })
  }

  // 3. Save config (atomic from HA's perspective)
  await ha.send({
    type: 'lovelace/config/save',
    url_path: urlPath,
    config,
  })

  // 4. Optionally make it default
  if (options.setAsDefault) {
    // Note: setting default dashboard is per-user, requires UI prompt
    // We don't do this automatically — surface as a button instead
  }
}
```

## YAML-mode apply mechanics

If the user has YAML mode enabled in HA's `configuration.yaml`:

```yaml
lovelace:
  mode: yaml
```

…then storage mode WS calls fail. In that case, Lovelacer's "apply" button switches to **export**: it writes `ui-lovelace.yaml` (or a configurable filename) to a path the user specifies, with instructions for adding it to their HA config.

Detection at runtime via `lovelace/config` mode field. If detected, UI nudges: "Your HA is in YAML mode. Lovelacer will export a file you can include."

## Re-generation and diffing

When a user re-runs analysis:

1. Generator produces a new `LovelaceConfig`.
2. Backend pulls current `lovelacer-home` config from HA.
3. Diff is computed at the entity level: which entities are new, removed, or moved between rooms.
4. UI shows a diff: "12 new entities will be added (8 to Kitchen, 4 to Office). 1 entity moved (light.kitchen_old → Misc)."
5. User confirms; new config replaces old.

Customizations the user made to the dashboard outside Lovelacer (in the HA UI editor) **will be lost**. This is communicated clearly in the apply dialog. A future version may preserve user customizations through structured merging, but MVP treats Lovelacer as authoritative for its own dashboard.

## Validation

Before any apply, the generated config is validated:

- Every entity referenced must exist in the registry (no dangling IDs)
- Every card type must be in the supported list
- JSON schema validation against the Lovelace schema (we ship a stripped subset)
- Total config size below 1 MB (HA's practical limit)

If validation fails, apply is blocked and the user sees the specific error.

## Performance targets

| Install size  | Analyze  | Generate | Apply    |
| ------------- | -------- | -------- | -------- |
| 50 entities   | < 100 ms | < 50 ms  | < 200 ms |
| 200 entities  | < 250 ms | < 100 ms | < 300 ms |
| 1000 entities | < 1 s    | < 500 ms | < 1 s    |

Measured end-to-end excluding network latency to HA.
