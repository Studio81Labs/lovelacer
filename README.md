# Lovelacer

<p align="center">
  <img src="docs/screenshots/01-hero.png" alt="Lovelacer — Home Assistant dashboards that organize themselves" width="960">
</p>

<p align="center">
  <img src="https://img.shields.io/badge/license-MIT-amber" alt="License: MIT">
  <img src="https://img.shields.io/badge/add--on-0.5.0-amber" alt="Add-on version">
  <a href="https://github.com/Studio81Labs/lovelacer/actions/workflows/ci.yml"><img src="https://github.com/Studio81Labs/lovelacer/actions/workflows/ci.yml/badge.svg" alt="CI status"></a>
</p>

> Organize your Home Assistant entities and generate a clean dashboard in minutes.

Lovelacer analyzes your Home Assistant setup, groups entities by room, filters noise, and generates a dashboard you can preview before applying.

No YAML required.<br>
No cloud required.<br>
Nothing changes until you click **Apply**.

---

## Why Lovelacer exists

Home Assistant is incredibly flexible, but the default dashboard often exposes too much raw structure:

- duplicated sensors
- helper entities
- diagnostics
- inconsistent naming
- integrations dumping everything into one view

Lovelacer creates a cleaner starting point automatically.

Instead of manually organizing entities and building dashboards card by card, Lovelacer helps you:

- detect rooms
- group entities by domain
- hide noise
- preview the result
- apply a separate generated dashboard safely

## How it works

### 1. Analyze your Home Assistant setup

Lovelacer reads your Home Assistant entity, device, and area registries.

It detects:

- rooms
- domains
- noisy entities
- low-confidence assignments

### 2. Review and adjust

Review grouped entities before anything is applied.

You can:

- move entities between rooms
- hide unwanted entities
- review low-confidence assignments

### 3. Preview the generated dashboard

Lovelacer generates a clean Lovelace dashboard using Home Assistant's native Sections layout.

The generated dashboard:

- stays fully editable in Home Assistant
- uses built-in cards
- is created separately from your existing dashboards

### 4. Apply safely

Nothing changes automatically.

Lovelacer:

- creates a separate dashboard
- never overwrites your existing dashboard
- lets you re-analyze and regenerate later

## Current Scope

The current release focuses on:

- room detection
- dashboard generation
- review and preview workflow
- safe dashboard apply flow

Planned future exploration includes:

- HomeKit targeting
- Google Home targeting
- Smart Panel export
- optional AI-assisted suggestions

These are intentionally not part of the first release.

## Features

- Room-based entity grouping
- Confidence scoring
- Entity review workflow
- Dashboard preview
- Storage-mode Lovelace generation
- YAML export
- No cloud dependency
- No telemetry
- Home Assistant add-on support
- Standalone Docker support

## Design Principles

Lovelacer is intentionally:

- local-first
- deterministic
- transparent
- lightweight
- Home Assistant-native

It is **not**:

- a replacement for Home Assistant
- a custom dashboard runtime
- an AI-first product
- a locked cloud platform

## Installation

### Home Assistant Add-on

Add the Lovelacer repository to Home Assistant add-ons:

```txt
https://github.com/Studio81Labs/lovelacer
```

Then:

1. Install the add-on.
2. Open Lovelacer.
3. Click Analyze.
4. Review the result.
5. Apply the generated dashboard.

Full add-on instructions and troubleshooting are in [`docs/ADDON_INSTALL.md`](./docs/ADDON_INSTALL.md).

### Standalone Docker

Standalone Docker support is available for Home Assistant Core users.

Documentation coming soon.

## Privacy

Lovelacer works locally by default.

- No telemetry
- No cloud required
- No external API calls
- No data collection

Future AI-assisted features will remain optional and opt-in.

## Roadmap

### Current Focus

- stable public alpha
- better heuristics
- more integrations
- improved room detection
- dashboard polish

### Exploring Next

- entity targeting workflows
- HomeKit filtering/export
- Google Home targeting
- Smart Panel integration

See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the full project roadmap.

## Screenshots

|                                                                                                |                                                                                                                  |
| :--------------------------------------------------------------------------------------------: | :--------------------------------------------------------------------------------------------------------------: |
| <img src="docs/screenshots/02-onboarding-welcome.png" alt="First-run wizard: pick a language"> |          <img src="docs/screenshots/03-diff-view.png" alt="Re-analyze diff banner with per-row badges">          |
|                  The first-run wizard. Pick a language; the rest auto-fills.                   |                        Re-analyze after you add devices. The diff view shows what moved.                         |
|            <img src="docs/screenshots/04-suggestions.png" alt="Suggestions panel">             | <img src="docs/screenshots/05-applied-in-ha.png" alt="The generated dashboard rendered inside HA's Lovelace UI"> |
|                     Smart suggestions. Accept improvements with one click.                     |                           The result. A native HA dashboard. No custom cards required.                           |

## Development Status

Public alpha in progress.

The current version is focused on validating:

- heuristics quality
- dashboard usefulness
- review workflow UX

before expanding into broader entity management workflows.

## Documents

| File                                                             | Purpose                                                                |
| ---------------------------------------------------------------- | ---------------------------------------------------------------------- |
| [`docs/PRD.md`](./docs/PRD.md)                                   | Personas, problem, scope, competitive landscape, monetization, metrics |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                 | Tech stack, components, storage mode, and Home Assistant integration   |
| [`docs/HEURISTICS.md`](./docs/HEURISTICS.md)                     | Room detection, multi-language matching, and confidence scoring        |
| [`docs/DASHBOARD_GENERATION.md`](./docs/DASHBOARD_GENERATION.md) | View layout, domain card mapping, and example outputs                  |
| [`docs/AI_FEATURES.md`](./docs/AI_FEATURES.md)                   | Optional AI design, provider abstraction, and privacy boundaries       |
| [`docs/ADDON_INSTALL.md`](./docs/ADDON_INSTALL.md)               | Home Assistant add-on installation walkthrough and troubleshooting     |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md)                           | Phased plan with real tickets and acceptance criteria                  |

## License

MIT. See [`LICENSE`](./LICENSE).

## Acknowledgements

Built for the Home Assistant community.

Inspired by years of manually cleaning up dashboards, filters, and entity chaos.
