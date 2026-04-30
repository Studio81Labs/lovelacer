# Architecture — Lovelacer

**Status:** Draft v1 · **Last updated:** 2026-04-27

## System overview

```
┌──────────────────────────────────────────────────────────────────┐
│                       Home Assistant Core                         │
│                                                                    │
│  Registries           WebSocket API           Lovelace Storage    │
│  ┌──────────┐         ┌─────────────┐         ┌──────────────┐   │
│  │ entity   │◀────────│ get_states  │         │  /config/    │   │
│  │ device   │         │ get_config  │         │  .storage/   │   │
│  │ area     │         │ subscribe_* │         │  lovelace_*  │   │
│  │ floor    │         │ lovelace/*  │◀───────▶│              │   │
│  └──────────┘         └──────┬──────┘         └──────────────┘   │
└────────────────────────────────┼──────────────────────────────────┘
                                 │ WebSocket (Supervisor token)
                                 │
┌────────────────────────────────┼──────────────────────────────────┐
│                    Lovelacer Add-on (Docker)                       │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                     HA Client Layer                          │  │
│  │      reconnecting WS, REST fallback, schema validation       │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                    Analysis Pipeline                          │  │
│  │  Normalize → Detect Rooms → Score → Group → Suggest          │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │                  Generator (storage / YAML)                   │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
│                                 │                                  │
│  ┌──────────────────────────────▼──────────────────────────────┐  │
│  │              Fastify HTTP API + SQLite                        │  │
│  │     /api/analyze  /api/preview  /api/apply  /api/overrides   │  │
│  └──────────────────────────────┬──────────────────────────────┘  │
└────────────────────────────────┼──────────────────────────────────┘
                                 │ Ingress (Supervisor) or HTTP
                                 │
                          ┌──────▼───────┐
                          │  Vue 3 SPA   │
                          │  Vite build  │
                          └──────────────┘
```

## Components

### HA Add-on (Docker container)

A standard HA Add-on packaged via `Dockerfile` + `config.yaml`. Runs the Node.js backend and serves the built Vue SPA. Configured for **Supervisor ingress** so users access it through the HA sidebar without a separate port.

### HA Client Layer (`packages/ha-client`)

Handles all communication with HA Core:

- WebSocket connection with auto-reconnect and exponential backoff
- Auth via `SUPERVISOR_TOKEN` env var (Add-on context) or long-lived token (standalone Docker)
- Wraps `config/entity_registry/list`, `config/device_registry/list`, `config/area_registry/list`, `config/floor_registry/list`, and `lovelace/dashboards/*` endpoints
- Subscribes to registry update events for live re-analysis

### Analysis Pipeline (`packages/analyzer`)

Pure functions, no I/O. Takes raw registry data, returns annotated room assignments with confidence scores. Detailed in [HEURISTICS.md](./HEURISTICS.md).

### Generator (`packages/generator`)

Takes the analyzer output and produces a Lovelace config. Two output modes:

- **Storage mode** — JSON shape matching `lovelace/dashboards/<id>/config` payload
- **YAML mode** — equivalent serialized YAML, written to file or returned for download

Detailed in [DASHBOARD_GENERATION.md](./DASHBOARD_GENERATION.md).

### AI provider layer (`packages/ai`, Tier 2)

Optional. Activated when `ai.enabled: true` in Add-on options. Provides:

- `LLMProvider` interface with implementations for Anthropic, OpenAI, Ollama, Lovelacer Cloud
- Schema-validated structured output (Zod schemas per feature)
- Cost tracking and budget enforcement
- Provider-agnostic prompt templates

The analyzer and generator have no direct dependency on `packages/ai`. Instead, they accept an optional `aiAdvisor` interface they can call for fallback decisions. This keeps the OSS tier clean: an Add-on built without `packages/ai` linked still works as a complete Tier 1 product.

See [`AI_FEATURES.md`](./AI_FEATURES.md) for full design.

### API server (`packages/server`)

Fastify HTTP server. Endpoints:

| Method | Path               | Purpose                                                |
| ------ | ------------------ | ------------------------------------------------------ |
| `GET`  | `/api/health`      | Liveness, HA connection status                         |
| `POST` | `/api/analyze`     | Trigger analysis, return room assignments + confidence |
| `GET`  | `/api/preview`     | Return generated dashboard config (no apply)           |
| `POST` | `/api/apply`       | Apply config — creates new dashboard via WS            |
| `GET`  | `/api/overrides`   | Get manual overrides for current install               |
| `PUT`  | `/api/overrides`   | Set/update overrides                                   |
| `GET`  | `/api/export.yaml` | Stream YAML export                                     |

### Frontend SPA (`packages/web`)

Vue 3 + Vite + Pinia. Three primary screens:

- **Analyze** — kick off analysis, see progress
- **Review** — room-grouped entity list with confidence badges and override controls
- **Preview & Apply** — rendered preview of the generated dashboard, apply button

## The big architectural decision: Storage mode vs YAML mode

This decision shapes everything downstream. Locking it now.

### Background

HA Lovelace dashboards live in two possible places:

- **Storage mode (UI mode)** — Default since 2020. Configs live as JSON in `.storage/lovelace`, `.storage/lovelace.<dashboard_id>`. Edited via the HA UI. The user toggles "Take control" / "Edit dashboard" and the frontend writes back via the `lovelace/config/save` WebSocket command.
- **YAML mode** — Opt-in. Configs live in `ui-lovelace.yaml` or referenced files. Edited by hand. HA reads them on startup or via `reload_lovelace`.

### The split

| Aspect                      | Storage mode                              | YAML mode                            |
| --------------------------- | ----------------------------------------- | ------------------------------------ |
| Default for new HA installs | ✅                                        | ❌                                   |
| User base estimated share   | ~85%                                      | ~15% (mostly power users)            |
| API to apply changes        | WebSocket `lovelace/config/save`          | File write + reload                  |
| Atomic updates              | ✅                                        | ⚠️ (file write race)                 |
| Versioning / rollback       | Manual                                    | Git-friendly                         |
| Multiple dashboards         | Built-in via `lovelace/dashboards/create` | Requires manual `dashboards:` config |

### Decision

**Lovelacer defaults to storage mode.** YAML export is supported as a feature but not the apply mechanism.

**Rationale:**

1. Storage mode covers the vast majority of users.
2. WebSocket apply is atomic, transactional, and rollback-friendly via dashboard create/delete.
3. We never overwrite the user's existing dashboard — we always create a new one (e.g., `Lovelacer — Home`). User chooses whether to make it default.
4. YAML export still serves the power-user case (Tinkerer Tomáš) who wants to scaffold and then customize in their own repo.

### Apply flow (storage mode)

```
1. User clicks Apply
2. Backend calls lovelace/dashboards/create
   → { url_path: 'lovelacer-home', title: 'Lovelacer — Home', icon: 'mdi:home-variant', show_in_sidebar: true }
3. HA returns dashboard_id
4. Backend calls lovelace/config/save
   → { url_path: 'lovelacer-home', config: <generated config> }
5. HA persists, frontend reloads sidebar
6. User opens new dashboard from sidebar
```

If the user re-runs and applies again, we **update** the existing `lovelacer-home` dashboard rather than creating duplicates.

## Authentication

### In Add-on context (primary)

Supervisor injects `SUPERVISOR_TOKEN` into the container env. Backend uses this token for both:

- Supervisor API calls (Add-on info, ingress)
- HA Core WebSocket (via `http://supervisor/core/websocket`)

No user-facing auth setup. This is the seamless path.

### In standalone Docker (secondary)

User configures:

- `HA_URL` — e.g., `http://homeassistant.local:8123`
- `HA_TOKEN` — long-lived access token created in HA user profile

Backend uses these directly. Documented in setup guide.

## Tech stack

| Layer              | Choice                        | Rationale                                                            |
| ------------------ | ----------------------------- | -------------------------------------------------------------------- |
| Backend runtime    | Node.js 20 LTS                | Mature, async-friendly, broad lib support, you know it               |
| Backend framework  | Fastify                       | Fast, schema-first (good for HA payload validation), small footprint |
| WebSocket client   | `home-assistant-js-websocket` | Official-ish, used by HA's own frontend, handles auth + reconnection |
| Local storage      | SQLite via `better-sqlite3`   | Zero ops, single file, perfect for overrides + cache                 |
| Frontend framework | Vue 3 + Composition API       | Your preference, matches Studio81/FastyBird stack                    |
| Frontend build     | Vite                          | Fast dev, good Add-on bundle output                                  |
| State              | Pinia                         | Standard Vue 3 store                                                 |
| Styling            | Tailwind CSS v4               | Your standard; matches FastyBird redesign                            |
| Component lib      | None (custom)                 | Keep it small, match HA's visual language                            |
| Package mgmt       | pnpm workspaces               | Monorepo with shared types                                           |
| Lang               | TypeScript                    | Strict mode                                                          |

## Repo structure

```
lovelacer/
├── apps/
│   └── addon/              # HA Add-on packaging (Dockerfile, config.yaml)
├── packages/
│   ├── ha-client/          # WS + REST client to HA Core
│   ├── analyzer/           # Heuristics, pure functions
│   ├── generator/          # Lovelace config builder
│   ├── ai/                 # LLM providers + AI features (Tier 2, optional)
│   ├── server/             # Fastify API
│   ├── web/                # Vue 3 SPA
│   └── shared/             # Shared TS types, constants, i18n strings
├── tests/
│   ├── fixtures/           # Sample HA registry dumps for testing
│   └── e2e/                # Playwright against a real HA instance
├── docs/
└── README.md
```

## Local data model (SQLite)

```sql
-- Manual entity-to-room overrides
CREATE TABLE overrides (
  ha_install_id TEXT NOT NULL,        -- from HA's hassio info
  entity_id     TEXT NOT NULL,
  room_id       TEXT,                  -- null = "hide from generation"
  reason        TEXT,                  -- 'manual', 'rejected_suggestion'
  updated_at    INTEGER NOT NULL,
  PRIMARY KEY (ha_install_id, entity_id)
);

-- Cached analysis runs (for diffing on re-analyze)
CREATE TABLE analysis_runs (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  ha_install_id TEXT NOT NULL,
  ran_at        INTEGER NOT NULL,
  entity_count  INTEGER,
  room_count    INTEGER,
  result_json   TEXT NOT NULL          -- full analysis result
);

-- User preferences
CREATE TABLE settings (
  ha_install_id TEXT NOT NULL,
  key           TEXT NOT NULL,
  value         TEXT,                  -- JSON
  PRIMARY KEY (ha_install_id, key)
);
```

## Configuration

Add-on options (`config.yaml`):

```yaml
options:
  language: 'auto' # auto | en | cs | de | es | fr | it | pl | nl
  log_level: 'info'
  apply_strategy: 'create' # create | update_existing
  dashboard_title: 'Lovelacer — Home'
  dashboard_url_path: 'lovelacer-home'
  show_low_confidence: true
  card_pack: 'core' # core | mushroom (future)

  # Tier 2 — AI features (optional)
  ai:
    enabled: false
    provider: 'ollama' # anthropic | openai | ollama | lovelacer-cloud
    model: '' # provider-specific default if empty
    api_key: '' # not required for Ollama
    base_url: '' # for Ollama or self-hosted
    confidence_threshold: 0.5 # AI fallback when heuristic confidence below this
    budget:
      max_cost_per_run_usd: 0.10
      max_calls_per_run: 50
    features:
      room_detection: true
      rename_suggestions: true
      layout_suggestions: true
      inline_hints: true
      natural_language: false
      automation_suggestions: false
      style_learning: false

schema:
  language: list(auto|en|cs|de|es|fr|it|pl|nl)
  log_level: list(trace|debug|info|warn|error)
  apply_strategy: list(create|update_existing)
  dashboard_title: str
  dashboard_url_path: match(^[a-z0-9-]+$)
  show_low_confidence: bool
  card_pack: list(core|mushroom)
  ai:
    enabled: bool
    provider: list(anthropic|openai|ollama|lovelacer-cloud)
    model: str?
    api_key: password?
    base_url: str?
    confidence_threshold: float(0,1)
    budget:
      max_cost_per_run_usd: float(0,10)
      max_calls_per_run: int(1,500)
    features:
      room_detection: bool
      rename_suggestions: bool
      layout_suggestions: bool
      inline_hints: bool
      natural_language: bool
      automation_suggestions: bool
      style_learning: bool
```

## Distribution

### HA Add-on (primary)

Repository: `github.com/<owner>/lovelacer-addon` (separate from main code repo, contains Add-on packaging only — referenced as a submodule).

Users add the repo URL via Settings → Add-ons → Add-on Store → ⋮ → Repositories.

CI publishes a multi-arch image (amd64, aarch64, armv7) per release tag.

### Standalone Docker (secondary)

`docker-compose.yml` published in main repo. User provides `HA_URL` and `HA_TOKEN`.

## Local development

```bash
# Run HA in a dev container with sample entities
docker compose -f dev/ha-stack.yml up -d

# Backend with hot reload
pnpm --filter server dev

# Frontend with hot reload, proxies to backend
pnpm --filter web dev
```

`dev/ha-stack.yml` includes a HA Core container with a pre-seeded entity registry containing ~200 fixture entities across 8 rooms — enough to exercise heuristics without needing real hardware.

## Testing strategy

| Layer       | Approach                                                               |
| ----------- | ---------------------------------------------------------------------- |
| `analyzer`  | Unit tests against fixture registries (multiple languages, edge cases) |
| `generator` | Snapshot tests of generated configs                                    |
| `ha-client` | Mock WebSocket server, replay-based tests                              |
| `server`    | Fastify supertest, integration with in-memory SQLite                   |
| `web`       | Vitest for stores, minimal component tests                             |
| End-to-end  | Playwright against a real HA Core dev container                        |

## Observability

- Structured JSON logs via `pino`
- Optional Sentry for error reporting (opt-in via Add-on options)
- `/api/health` exposes connection state, last analysis time, override count

## Open architectural questions

1. Should `analyzer` and `generator` run in a worker thread for large installs (1000+ entities)? Probably not at MVP; revisit if benchmarks show > 200ms.
2. Do we need real-time updates in the preview when entities change in HA, or is "click re-analyze" enough? Latter is simpler; defer until user feedback says otherwise.
3. Migration story when we change the analyzer between versions — how does an existing generated dashboard get updated without losing user customizations? Open question; for MVP, regeneration replaces wholesale.
