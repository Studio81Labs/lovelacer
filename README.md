# Lovelacer

> Working codename. Alternates: DashCraft, AutoLace, Roomly, HA Dashboard Generator. Pick before public repo.

**One-liner:** Point Lovelacer at your Home Assistant install and get a clean starting dashboard you can actually use — in under five minutes, without writing YAML.

## Status

Early. PRD and architecture locked. No code yet. See [`docs/ROADMAP.md`](./docs/ROADMAP.md) for the build plan.

## Why this exists

Home Assistant is the most flexible smart home platform on the market and also the one most likely to leave a new user staring at a wall of `sensor.0x00158d000123abcd_battery` entities with no idea where to start. The official UI auto-generates a dashboard, but it's notoriously bad: every entity dumped into a single view, no grouping, no per-room structure, no opinion. The community workaround is to spend a weekend learning Lovelace YAML, custom cards, and the area/device data model.

Lovelacer does that weekend's work in five minutes — read the entity registry, infer rooms, group sensibly, generate a real dashboard, preview before applying.

## Architecture at a glance

```
┌─────────────────────────────────────────────────────────────┐
│                    Home Assistant Core                       │
│  ┌──────────┐  ┌────────────┐  ┌────────────────────────┐  │
│  │ Entities │  │   Areas    │  │  Lovelace Storage API  │  │
│  └────┬─────┘  └──────┬─────┘  └───────────┬────────────┘  │
└───────┼───────────────┼────────────────────┼───────────────┘
        │ WebSocket API │                    │ WS lovelace/*
        ▼               ▼                    ▲
┌─────────────────────────────────────────────────────────────┐
│              Lovelacer Add-on (Docker)                       │
│  ┌──────────────┐  ┌──────────────┐  ┌─────────────────┐   │
│  │ HA Client    │→ │ Analyzer +   │→ │ Generator       │   │
│  │ (ws + rest)  │  │ Heuristics   │  │ (storage/YAML)  │   │
│  └──────────────┘  └──────┬───────┘  └────────┬────────┘   │
│                           ▼                   ▼             │
│                    ┌─────────────────────────────────┐      │
│                    │  Fastify API + SQLite (state)   │      │
│                    └────────────────┬────────────────┘      │
└─────────────────────────────────────┼────────────────────────┘
                                      │ HTTP
                                      ▼
                              ┌──────────────┐
                              │ Vue 3 SPA    │
                              │ (Preview UI) │
                              └──────────────┘
```

Full breakdown in [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md).

## Documents

| File                                                             | Purpose                                                                                   |
| ---------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| [`docs/PRD.md`](./docs/PRD.md)                                   | Personas, problem, scope, competitive landscape, three-tier monetization, success metrics |
| [`docs/ARCHITECTURE.md`](./docs/ARCHITECTURE.md)                 | Tech stack, components, storage-mode-vs-YAML-mode decision, HA integration                |
| [`docs/HEURISTICS.md`](./docs/HEURISTICS.md)                     | Room detection chain, multi-language matching, confidence scoring                         |
| [`docs/DASHBOARD_GENERATION.md`](./docs/DASHBOARD_GENERATION.md) | View layout, per-domain card mapping, example outputs                                     |
| [`docs/AI_FEATURES.md`](./docs/AI_FEATURES.md)                   | Tier 2 / Tier 3 AI design, LLM provider abstraction, privacy boundaries                   |
| [`docs/SMART_PANEL_BRIDGE.md`](./docs/SMART_PANEL_BRIDGE.md)     | Strategic relationship to FastyBird Smart Panel — export target, not marketing funnel     |
| [`docs/ROADMAP.md`](./docs/ROADMAP.md)                           | Phased plan with real tickets and acceptance criteria                                     |

## Decisions locked

- **Distribution:** Home Assistant Add-on (Supervisor-managed) as primary channel, standalone Docker as secondary.
- **Apply mode:** Lovelace **storage mode** by default (writes via WebSocket), with YAML export as a feature.
- **Stack:** Node.js + Fastify backend, Vue 3 + Vite frontend, SQLite for local state.
- **i18n:** Multi-language room detection from day one (EN, CS, DE, ES, FR, IT, PL, NL).
- **License:** MIT for OSS core. AI features are also MIT but require runtime configuration of an LLM provider.
- **Monetization:** Three tiers — Free/OSS, AI/BYO key (still free, user pays LLM provider), Pro/managed cloud (subscription, future).
- **Privacy:** Tier 2 with Ollama provider = zero external requests, full AI features. Tier 3 cloud handles only entity registry metadata, never sensor states.

## Decisions still open

- **Project name** — `Lovelacer` is a placeholder and likely too insider for the target audience. Working public-name candidate: **Roomly**. Repo bootstraps under a neutral `ha-dashboard-builder` slug until domain availability is verified. Final name locked before Phase 1a closes.
- **Tier 3 pricing** — $5/mo, $9/mo, $99 lifetime — needs validation post-Tier-2.
- **Tier 3 build trigger** — what specific metric flips the "build it" switch.
- **Custom card support** — pure-core for MVP; Mushroom/Tile-extras as opt-in later?
- **Default LLM models** — ship with Haiku + GPT-4o-mini + llama3.1:8b as defaults?

## Next step

Read the [PRD](./docs/PRD.md), then the [Roadmap](./docs/ROADMAP.md). Phase 0 starts with repo bootstrap and HA dev environment.
