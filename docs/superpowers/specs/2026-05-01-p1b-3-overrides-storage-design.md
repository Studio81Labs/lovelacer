# P1b-3 — Override storage and API

**Status:** Design approved 2026-05-01

**Goal:** Add the first persistent storage layer to Lovelacer. Users can override the analyzer's per-entity room assignment and/or hide an entity from the generated dashboard. Overrides survive add-on restarts (HA Supervisor's `/data` volume) and apply transparently during analysis.

**Out of scope:** the frontend UI for editing overrides — that's P1b-4. This ticket ships the SQLite schema, the `/api/overrides` GET + PUT endpoints, and the pipeline integration that applies overrides during analyze/preview/apply.

---

## Architecture

A new `OverrideStore` class wraps `better-sqlite3` (already in `packages/server/package.json` from P1a). It exposes three methods:

- `getAll(): Override[]` — read all rows
- `replaceAll(overrides: Override[]): void` — atomic transaction: `DELETE FROM overrides; INSERT ...`
- (no individual upsert/delete — full-list semantics simplifies routes and avoids race conditions for the single-user single-install case)

**Lifecycle:**

- Constructed once at app startup with a path resolved from `${config.dataDir}/lovelacer.sqlite`.
- The store ensures the data dir exists (`mkdir -p` semantics) on construction so first run on a fresh checkout works without setup.
- In the HA add-on context, `DATA_DIR=/data` is already set in `apps/addon/run.sh` so the file persists across add-on restarts (HA Supervisor provisions `/data` as the addon's persistent volume). No Dockerfile changes needed.
- In dev mode the file lands in `./data/lovelacer.sqlite`. The `.gitignore` already includes `*.sqlite` and `*.sqlite-journal` from P0; the store inherits that protection.
- In tests, the store accepts a `:memory:` path so each test gets an isolated DB.

**Module location:** `packages/server/src/storage/override-store.ts` (new directory). `storage/` is the home for any future SQLite-backed module.

**Pipeline integration:** `runFullPipeline` in `packages/server/src/pipeline.ts` gains an `overrides: OverrideStore` parameter. Right after `detect()` produces `assignments`, an inline helper calls `applyOverrides({ assignments, entities }, overrides.getAll())` which mutates both arrays in place. Existing hidden/disabled filters in the rest of the pipeline keep working unchanged.

**API:** route plugin `overridesRoute` registered in `app.ts` alongside the existing routes, gets the store via plugin options.

```
HA registries → normalize → detect → applyOverrides ← OverrideStore → groupByDomain → views
                                          │
                                          └─ /api/overrides (GET/PUT)
```

---

## Database schema

Single table `overrides`, created on store construction via `CREATE TABLE IF NOT EXISTS`:

```sql
CREATE TABLE IF NOT EXISTS overrides (
  entity_id   TEXT    PRIMARY KEY,
  room_id     TEXT,                          -- one of CanonicalRoomId, or NULL
  hidden      INTEGER NOT NULL DEFAULT 0,    -- 0 or 1 (SQLite has no bool)
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
  CHECK (room_id IS NOT NULL OR hidden = 1)
);
```

**Field choices:**

- `entity_id` as PK — each entity has at most one override row
- `room_id` nullable — the user might only set `hidden: true` without moving the entity
- `hidden` as `INTEGER` — SQLite convention (0/1); store maps `1 → true` on read
- `updated_at` as Unix timestamp — useful for debugging; not exposed in the API yet (YAGNI)
- `CHECK` constraint enforces meaningfulness at the DB level — a row with `room_id = NULL AND hidden = 0` is rejected. Belt-and-suspenders alongside the API zod validator.

**Migration strategy:** for now, just `CREATE TABLE IF NOT EXISTS` on store construction. No version table, no migration runner. When the schema needs to evolve (e.g., adding `friendly_name` for rename support), we add a `schema_version` table and a migration array. YAGNI for P1b-3.

**TypeScript shape** in `packages/shared/src/overrides.ts` (new file):

```ts
import type { CanonicalRoomId } from './constants.js'

export interface Override {
  entityId: string
  roomId?: CanonicalRoomId // optional: undefined means "don't move"
  hidden?: boolean // optional: undefined or false means "don't hide"
}
```

The shared type uses `roomId?` rather than `roomId: CanonicalRoomId | null` because zod's `.optional()` produces undefined-or-present, which composes cleaner with `exactOptionalPropertyTypes: true`. The DB layer translates `NULL ↔ undefined` at read/write boundaries.

---

## API contract

### `GET /api/overrides`

Returns all overrides. 200 always (empty array if none).

```json
{
  "overrides": [
    { "entityId": "light.kitchen_ceiling", "roomId": "living_room" },
    { "entityId": "sensor.useless_diagnostic", "hidden": true },
    { "entityId": "media_player.tv", "roomId": "bedroom", "hidden": false }
  ]
}
```

The wrapper `{ overrides: [...] }` (rather than a bare array) keeps the response future-friendly — we can add `count`, `lastUpdatedAt`, etc. later without breaking clients. Same pattern as the existing `runAnalyze` response.

### `PUT /api/overrides`

Body: `{ overrides: Override[] }`. Replaces the entire collection in a single transaction. Returns the new collection (echo) as 200.

**Request validation** via zod:

```ts
const OverrideSchema = z
  .object({
    entityId: z
      .string()
      .min(1)
      .regex(/^[a-z_][a-z0-9_]*\.[a-z0-9_]+$/, 'must be a valid HA entity_id'),
    roomId: z.enum(CANONICAL_ROOMS).optional(),
    hidden: z.boolean().optional(),
  })
  .refine((o) => o.roomId !== undefined || o.hidden === true, {
    message: 'override must set roomId or hidden=true (or both)',
  })

const PutBodySchema = z.object({
  overrides: z
    .array(OverrideSchema)
    .refine((arr) => new Set(arr.map((o) => o.entityId)).size === arr.length, {
      message: 'duplicate entityId',
    }),
})
```

**Errors:**

- `400 invalid_body` — body fails schema validation; response includes the zod error path
- `500 storage_error` — `better-sqlite3` threw (disk full, corrupt file, etc.)

### Why GET + PUT (not POST)

The existing routes (`POST /api/analyze`, `/api/preview`, `/api/apply`) are RPC-style actions ("do this thing"). Overrides is a literal collection — GET reads it, PUT replaces it. RESTful semantics fit. We don't ship DELETE in P1b-3 since `PUT { overrides: [] }` achieves the same effect.

### Pipeline route changes

The existing `runAnalyze`, `runPreview`, `runApply` functions all call `runFullPipeline(ha)`. We change the signature to `runFullPipeline(ha, overrides)` and thread the store through. Each route handler grabs the store via `opts.overrides` (mirrors `opts.ha` today).

---

## Pipeline patch logic

Free function in `packages/server/src/pipeline.ts` (kept here, not on `OverrideStore`, for testability — pure data transformation, no DB):

```ts
function applyOverrides(
  state: { assignments: RoomAssignment[]; entities: NormalizedEntity[] },
  overrides: Override[],
): void {
  if (overrides.length === 0) return // hot path — no DB rows, no mutation

  const byEntityId = new Map(overrides.map((o) => [o.entityId, o]))

  for (const a of state.assignments) {
    const o = byEntityId.get(a.entityId)
    if (o?.roomId !== undefined) {
      a.roomId = o.roomId
      a.confidence = 1.0
      a.manual = true
    }
  }
  for (const e of state.entities) {
    const o = byEntityId.get(e.entityId)
    if (o?.hidden === true) {
      e.isHidden = true
    }
  }
}
```

### `RoomAssignment` gains one optional field

In `packages/shared/src/types.ts`:

```ts
export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  /** True iff this assignment was overridden by user override (P1b-3). */
  manual?: boolean
}
```

Optional, undefined for detector-produced assignments. The analyzer never sets it. Frontend can show "you set this" by checking `assignment.manual === true`.

### Orphaned overrides

The user might override an entity that later gets removed from HA (uninstalled integration, renamed entity_id, etc.). The patch is keyed by `entityId`, so an override referencing a missing entity simply finds no match and does nothing — silently no-ops. We don't auto-delete orphaned overrides (the user might re-add the integration). YAGNI for cleanup; the API list shows them and the user can clear them via PUT.

### Why hidden but not disabled

Disabled entities are HA-level (user disabled them in HA's entity registry). Hidden via override is Lovelacer-only ("don't show this in MY dashboard even though HA exposes it"). Two different concepts, kept separate. The override schema doesn't expose `disabled`.

### `runFullPipeline` change

```ts
async function runFullPipeline(
  ha: HaClient,
  overrides: OverrideStore, // new param
): Promise<PipelineState> {
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])
  const entities = normalize({ entities: entityRegistry, devices: deviceRegistry })
  const assignments = detect({ entities, areas: areaRegistry })
  applyOverrides({ assignments, entities }, overrides.getAll()) // <-- new
  const groupings = groupByDomain({ assignments, entities })
  // ... rest unchanged
}
```

One line of new logic. The existing hidden/disabled filter `(!e.isHidden && !e.isDisabled)` does the rest of the work.

---

## Testing strategy

### Storage layer — `packages/server/src/storage/__tests__/override-store.test.ts`

`:memory:` SQLite DB per test, fresh schema each time:

- `getAll()` on empty DB returns `[]`
- `replaceAll([])` clears existing rows
- `replaceAll(...)` is atomic — inject a row with a CHECK violation mid-array; whole transaction rolls back, prior contents intact
- Round-trip: write `{entityId, roomId}` (no hidden) → read returns `{entityId, roomId}` (hidden absent because false-by-default)
- Round-trip: write `{entityId, hidden: true}` (no roomId) → read returns identical
- Round-trip: combined override → identical
- CHECK constraint rejects `{ entityId: 'x.y' }` with neither field set (caught by zod first, but defense-in-depth)

### Pipeline patch helper — `packages/server/src/__tests__/apply-overrides.test.ts` (new file)

Pure data-transform tests, no DB:

- Empty overrides → no mutation
- Single roomId override → `assignment.roomId` changed, `confidence === 1.0`, `manual === true`
- Single hidden override → `entity.isHidden = true`; existing `isHidden = true` stays (no flip-back)
- Combined override (`roomId` + `hidden`) → both apply
- Orphaned override (entityId not in assignments) → no mutation, no throw
- Multiple overrides at once → all apply
- Override sets `hidden: false` explicitly → no effect on entity (only `hidden: true` mutates)

### Route layer — `packages/server/src/routes/__tests__/overrides.test.ts`

Use the existing `createApp` + `inject` harness; instantiate a real `OverrideStore` with `:memory:` so the storage layer is exercised too (pseudo-integration without mocking):

- GET empty → `{ overrides: [] }`
- PUT valid array → 200, body echoed, GET returns same
- PUT empty array → 200, GET returns `{ overrides: [] }`
- PUT invalid entity_id format → 400 invalid_body
- PUT invalid roomId (not in CanonicalRoomId) → 400
- PUT no-op override (`{ entityId, hidden: false }` only) → 400 (rejected by zod refine)
- PUT duplicate entityId → 400
- PUT atomic — failed PUT mid-write doesn't half-update (verified via DB CHECK violation injection)

### Pipeline integration — extend `packages/server/src/__tests__/pipeline.test.ts`

End-to-end through `runAnalyze`:

- Build a fixture with `light.kitchen_ceiling` detected as `kitchen`
- Construct a store with override `{ entityId: 'light.kitchen_ceiling', roomId: 'living_room' }`
- Run `runAnalyze(ha, store)` — assert kitchen room loses the entity, living_room gains it, the assignment has `manual: true`
- Repeat for hidden: override marks an entity hidden, assert it's filtered from the response (count drops by 1, no assignment for that entityId in any room)

### What's NOT tested in P1b-3

- Frontend behavior — that's P1b-4
- Migration runner — there is none yet
- Multi-user/multi-install scoping — single-tenant addon assumption

---

## Acceptance

- [ ] `OverrideStore` class with `getAll`, `replaceAll`, plus tests against `:memory:` DB
- [ ] `Override` shared type in `@lovelacer/shared`
- [ ] `RoomAssignment.manual?: boolean` added
- [ ] `applyOverrides` helper with unit tests
- [ ] `GET /api/overrides` and `PUT /api/overrides` routes with validation + tests
- [ ] `runFullPipeline` threads `overrides` through analyze/preview/apply
- [ ] App startup wires the store via `config.dataDir`; store creates the dir if missing
- [ ] Add-on persistence verified — `apps/addon/run.sh` already sets `DATA_DIR=/data` (no work, just confirm)
- [ ] Pipeline integration test exercises an end-to-end override
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean
