# P0-2 Fixture Loader — Design

**Status:** Draft v1 · **Date:** 2026-04-30 · **Ticket:** [P0-2 in `docs/ROADMAP.md`](../../ROADMAP.md)

## Goal

Close the only outstanding gap in Phase 0: give the local Home Assistant dev container a realistic registry to read, so the AC for P0-2 — *"`pnpm dev:ha` brings up a HA instance with ≥150 entities across 6 rooms; token works for WS auth"* — is met, and the analyzer work that begins with P1a-1 has a real fixture to develop against.

## Non-goals

- Auth/token bootstrap. The user creates the admin account and a long-lived token manually per `dev/README.md`. The loader assumes that has happened.
- Lovelace dashboard seeding. Phase 0 is registry-only.
- A fixture management UI. The loader is a CLI script.
- Loading multiple fixtures simultaneously, merging fixtures, or partial updates. Each run replaces the registries wholesale.
- The four other named fixtures (`czech-tidy`, `german-massive`, `unset-areas`, `multilingual-mixed`). They are added by their respective Phase 1a/1b tickets.

## Approach summary

Hybrid: **storage-file overlay** for the four registries, **template-platform YAML** for the subset of P1a domains that supports declarative state. A typed TypeScript builder under `tests/fixtures/_builder/` is the single source of truth; the loader script derives both the `.storage/*` JSON files and the YAML block from it.

This keeps the on-disk shape uniform across every domain (registries describe everything, including domains the template integration cannot represent), while still giving the HA UI live state for the entities where it is cheap to provide.

## Architecture

```
tests/fixtures/
  english-cluttered.ts        # source of truth (TS module)
  _builder/
    types.ts                  # Fixture, FloorSpec, AreaSpec, DeviceSpec, EntitySpec
    helpers.ts                # floor / area / device / domain factories
    fixture.ts                # validating top-level constructor

dev/scripts/
  load-fixture.ts             # the CLI — orchestrates everything below

dev/ha-config/                # generated/patched at load time
  configuration.yaml          # patched: !include lovelacer-fixtures.yaml
  lovelacer-fixtures.yaml     # generated: template: block
  .storage/
    core.floor_registry       # generated
    core.area_registry        # generated
    core.device_registry      # generated
    core.entity_registry      # generated
    .lovelacer-backup-<ts>/   # generated: previous registries (last 5 kept)
```

## Components

### 1. Fixture builder — `tests/fixtures/_builder/`

Pure, no I/O. Exports:

- **Types:** `Fixture`, `FloorSpec`, `AreaSpec`, `DeviceSpec`, `EntitySpec` (mirrors HA's registry data fields plus a `domain` and an internal `unique_id`).
- **Helpers:**
  - `floor(name, opts?)` → `FloorSpec`
  - `area(name, { floor?, icon? })` → `AreaSpec`
  - `device(name, { manufacturer?, model?, area?, nameByUser? })` → `DeviceSpec`
  - Per-domain entity factories: `light`, `switch_`, `tempSensor`, `humiditySensor`, `motion`, `occupancy`, `door`, `climate`, plus generic `registryEntry(domain, …)` for P1b-only domains (cover, media_player, lock, camera, vacuum, fan).
  - Each takes `(objectId, { area?, device?, friendlyName?, nameByUser?, hidden?, disabled?, deviceClass?, entityCategory? })`. Object IDs default to slugified friendly name. `unique_id` is auto-generated as `<fixture-name>__<entity_id>`.
- **Validator:** `fixture({ meta, floors, areas, devices, entities })` — returns `Fixture`, throws on duplicate IDs, dangling area/device/floor references, or entity IDs that collide.

### 2. Loader script — `dev/scripts/load-fixture.ts`

Run via `pnpm fixtures:load <name>` (added to root `package.json`; `tsx` added as a root devDependency).

Steps, in order:

1. **Resolve fixture.** `await import(`../tests/fixtures/${name}.ts`)`. Fail fast with a clear message and a list of available fixtures (read from `tests/fixtures/*.ts`).
2. **Pre-flight check on `dev/ha-config/`.** Existence + presence of `.storage/auth` (the signal that the user finished onboarding). If missing, print a pointer to the `dev/README.md` first-time setup section and exit non-zero.
3. **Stop the HA container.** `docker compose -f dev/ha-stack.yml stop homeassistant`. If the container isn't running, skip without warning. If `docker` is unavailable, fail with a hint to install Docker.
4. **Back up existing registries.** Move any existing `core.{floor,area,device,entity}_registry` into `dev/ha-config/.storage/.lovelacer-backup-<ISO-timestamp>/`. Prune all but the most recent five backup directories.
5. **Write generated registry files** with HA's canonical envelope `{ version, minor_version, key, data }`. Schema versions hardcoded against HA `stable` at the time of writing (recorded inline in the loader as constants); a mismatch on existing files triggers a loud failure with both numbers in the message.
6. **Write `dev/ha-config/lovelacer-fixtures.yaml`** containing a `template:` block with the state-supporting entities. Domains in scope: `sensor` (temperature, humidity), `binary_sensor` (motion, occupancy, door), `switch`. Other domains are registry-only.
7. **Patch `configuration.yaml`** to include `lovelacer-fixtures.yaml` once. Idempotent via a sentinel comment (`# lovelacer:fixtures`). If `configuration.yaml` does not exist (fresh HA), create it with the default `default_config:` plus the include.
8. **Restart the container.** `docker compose -f dev/ha-stack.yml start homeassistant`. Poll the compose-defined healthcheck until green or 60 s timeout. Timeout is non-fatal — the script prints a warning and continues.
9. **Print summary:** fixture name, counts (floors / areas / devices / entities by domain), HA URL, and a one-line reminder that `.env`'s `HA_TOKEN` is unaffected.

### 3. The `english-cluttered` fixture

~165 entities, 6 rooms, deliberate cluttered signals. Distributed roughly:

| Room | Floor | Entities | Notes |
| --- | --- | --- | --- |
| Living Room | Ground | ~35 | light, climate, media_player, sensors |
| Kitchen | Ground | ~25 | light, sensors, appliance switches |
| Bathroom | Ground | ~15 | humidity, motion, light, fan switch |
| Bedroom | Upstairs | ~25 | lights, climate, motion |
| Office | Upstairs | ~20 | lights, switches, diagnostic-class outliers |
| Garage | Ground | ~20 | door binary_sensor, motion, switch |
| (no room — misc) | — | ~25 | unassigned, hub diagnostics, network/system entities |

Cluttered-signal distribution across the 165, on two independent axes:

**Area-attribution axis** (mutually exclusive, sums to 100%):

- ~40% have `area_id` on the entity directly.
- ~25% have no entity `area_id` but their device does (analyzer must propagate device → entity).
- ~25% have neither (analyzer falls back to friendly-name / object-id matching).
- ~10% are unassigned and unassignable — the misc bucket.

**Name-quality axis** (overlays the above; ~10% of all entities):

- Deliberately ambiguous friendly names (`Sensor 4`, manufacturer model strings, hex IDs like `0x158d000123abcd`).

**Other registry signals** (small absolute counts; specific entities chosen to land in the fixture):

- A handful use `name_by_user` to override `original_name`.
- A handful with `entity_category: "diagnostic"` (filter / surface separately).
- A handful `disabled_by` non-null (must be excluded).
- A handful `hidden_by: "user"` (excluded from default views).
- 2–3 with friendly names that legitimately straddle two rooms ("Hallway / Stairs Motion") — corroboration test.

Domain mix:

- light: ~30, switch: ~25, sensor (temp/humid only): ~50, binary_sensor (motion/occupancy/door only): ~30, climate: ~5, registry-only out-of-P1a-scope (cover, media_player, lock, fan): ~25.

The 6-room AC is interpreted as "six real rooms detection has to find." The misc bucket is the no-room fallback path, not a seventh room.

## Data flow

```
english-cluttered.ts
  └─ uses _builder/* helpers
     └─ exports Fixture { meta, floors[], areas[], devices[], entities[] }

load-fixture.ts
  ├─ imports Fixture
  ├─ stops HA
  ├─ backs up existing .storage/core.*_registry → .lovelacer-backup-<ts>/
  ├─ serializes Fixture → .storage/core.{floor,area,device,entity}_registry
  ├─ serializes Fixture[domain in {sensor, binary_sensor, switch}] → lovelacer-fixtures.yaml
  ├─ patches configuration.yaml (idempotent include)
  └─ starts HA, polls healthcheck

HA Core (on restart)
  ├─ reads .storage/* → entities surface in registry
  ├─ reads configuration.yaml → loads template integration → provides state for those entities
  └─ ws config/{floor,area,device,entity}_registry/list returns the fixture
```

## Error handling

- **Fixture not found:** print available fixtures (from `tests/fixtures/*.ts`); exit 1.
- **Fixture validation fails** (duplicate IDs, dangling references): the builder throws; the loader catches and prints the validator message; exit 1.
- **`dev/ha-config/` missing or no `auth` storage:** print a pointer to `dev/README.md`; exit 2.
- **`docker` missing:** print install hint; exit 3.
- **Storage schema-version mismatch on existing file:** print expected vs found; exit 4. (Hint: update the loader, then rerun.)
- **HA container start succeeds but healthcheck times out at 60 s:** print warning; exit 0. (HA may genuinely take longer on first boot with new config.)

All error paths are non-destructive after step 4 because the original registries are already in the timestamped backup directory.

## Testing

- **Builder unit tests** (`tests/fixtures/_builder/__tests__/`): validator catches duplicate floor/area/device/entity IDs; dangling references rejected; defaulting of `objectId` and `unique_id` works.
- **Loader integration test:** Vitest test that runs the loader against a sandbox `dev/ha-config/` (a temp dir; no Docker), asserts the four `.storage/*` files match a snapshot and `lovelacer-fixtures.yaml` matches a snapshot. Skipped in CI unless an env flag is set; primarily for local iteration. Docker-driven end-to-end is exercised manually on the dev stack.
- **`english-cluttered` self-tests:** a Vitest test that loads the fixture module and asserts the cluttered-signal distribution (e.g. "≥40% of entities have `area_id`", "≥25% are device-only", "exactly 6 rooms", "≥150 entities") so future edits to the fixture do not silently drift it back to "tidy."

## Open questions resolved during brainstorming

- **Loading mechanism:** hybrid (registries via `.storage/`, state via template YAML where supported).
- **Authoring format:** TypeScript builder, not raw JSON.
- **Auth bootstrap:** out of scope; user does manual onboarding first.
- **Scope:** `english-cluttered` only for this ticket. The other four fixtures land with their consumer tickets.
- **Re-run behavior:** wholesale replace; previous registries kept in `.lovelacer-backup-*` (last five).
- **HA restart cycle:** required; loader stops + starts the container.

## Risks

- **HA storage schema drift.** A future HA `stable` could bump `version`/`minor_version` of any registry file. Mitigated by failing loud on mismatch and pinning a known-good HA image tag in `dev/ha-stack.yml` if drift becomes recurrent.
- **Template integration limits.** If a P1a domain we expected to template against (e.g. switch) gets stricter requirements in a future HA, the YAML generator may need per-domain branches. Acceptable — surface area is small.
- **Backup churn.** Five timestamped directories per `pnpm fixtures:load` run. Disk cost is negligible (registry JSON is small) but worth eyeballing the prune logic.

## Acceptance

P0-2 is closed when:

- [ ] `pnpm fixtures:load english-cluttered` runs end-to-end against a freshly-onboarded `dev/ha-config/` and exits 0.
- [ ] After the loader runs, `pnpm dev` connects, `/api/health` reports `ha.connected: true`.
- [ ] A WS `config/entity_registry/list` returns ≥150 entries; `config/area_registry/list` returns 6 rooms.
- [ ] Re-running the loader with the same fixture is idempotent (no duplicate includes, no errors).
- [ ] Re-running with a *different* fixture (test artifact, even a trivial one) cleanly replaces; previous registries land in a backup dir.
- [ ] `pnpm test` passes including the new builder + fixture self-tests.
