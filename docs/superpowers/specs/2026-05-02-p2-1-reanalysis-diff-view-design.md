# P2-1 — Re-analysis Diff View — Design

**Status:** Draft v1 · **Date:** 2026-05-02 · **Phase:** 2 (Polish & Release) · **Sizing:** M

## Goal

Show what changed between the dashboard the user is looking at right now and the dashboard they last applied to Home Assistant. Surface adds, moves, and removals at three levels of detail (top-level summary, per-room badges, per-entity inline tags) so the user can scan and trust that re-applying won't surprise them.

**Acceptance criteria** (from ROADMAP.md):

- Adding 5 entities to dev HA → re-analyze shows 5 additions in correct rooms.
- Removed entity warning shown.

## Context

Phase 1b shipped: SQLite override storage (P1b-3), per-entity override UI (P1b-4), full home overview sections (P1b-5), and the closed-beta invite gate (P1b-6). The product is stable enough to ship to ~10 friendly testers, but it has no way to communicate what's *different* between an analysis and the user's current live dashboard. Re-applying feels like a black box: the user can't see what they're committing to before clicking Apply.

P2-1 closes that gap. After the first apply, every subsequent analyze shows a diff against the last-applied state. Users can edit overrides and watch the diff update live, so "Apply" becomes a confirmation of changes they already understand.

## Architecture & data flow

Three pieces, no new routes:

1. **At apply time** (frontend → server → SQLite). When the user clicks Apply, the frontend sends `body.snapshot = { assignments, config }` alongside `body.config` in the existing `POST /api/apply` call. `assignments` is `[{ entityId, roomId | null }]` derived client-side from `analyze.preview.rooms` (with their `roomId`) and `analyze.preview.misc` (encoded as `roomId: null`). The server persists both fields into a new `AppliedSnapshotStore` (single-row SQLite table, mirrors `InviteStore`). Persistence happens *after* `ha.applyDashboard()` succeeds — a failed apply doesn't poison the snapshot.

2. **At analyze time** (server). `runPreview()` (the function `POST /api/preview` calls) loads the persisted snapshot and computes a `DiffResult` against the current analysis. The diff lives in a new pure module `packages/analyzer/src/diff.ts` so it's testable in isolation. Output is included in `PreviewOutput`: `diff: DiffResult | null` (null when no snapshot exists yet).

3. **At render time** (frontend). The web `analyze` store exposes the diff alongside the existing `preview` data. New components: `DiffBanner.vue` (top of review screen), `RemovedEntitiesPanel.vue` (callout). Existing components extended: `RoomList.vue` (per-room badges), `EntityRow.vue` (inline tags).

Snapshot mutation is one-way: only `runApply()` writes; everything else reads. Fastify processes one request at a time per connection — no concurrency to defend against.

## Storage schema

New SQLite table, single-row pattern (matches `invite_acceptance`):

```sql
CREATE TABLE IF NOT EXISTS applied_snapshot (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  assignments TEXT    NOT NULL,            -- JSON: [{entityId, roomId|null}]
  config      TEXT    NOT NULL,            -- JSON: full LovelaceConfig
  applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

New `AppliedSnapshotStore` class in `packages/server/src/storage/applied-snapshot-store.ts`. Same shape as `OverrideStore` and `InviteStore`: prepared statements hoisted in the constructor, `mkdirSync(dirname, { recursive: true })` for file paths, `:memory:` for tests, `journal_mode = WAL`.

Public API:

```ts
interface AppliedSnapshot {
  assignments: SnapshotAssignment[]
  config: LovelaceConfig
  appliedAt: number  // unix seconds
}
interface SnapshotAssignment {
  entityId: string
  roomId: CanonicalRoomId | null  // null = misc / not in any room view
}

class AppliedSnapshotStore {
  get(): AppliedSnapshot | null     // null when first-run
  save(snapshot: Omit<AppliedSnapshot, 'appliedAt'>): void  // INSERT OR REPLACE
  close(): void
}
```

`save()` uses `INSERT OR REPLACE` so it's idempotent — the second apply atomically overwrites the first. `JSON.stringify` on write, `JSON.parse` on read; the route layer's zod validation guarantees what goes in.

JSON-blob (vs. a normalized assignments table) because we always read/write the entire snapshot at once — diffing is "full vs. full". A normalized table would mean N inserts per apply, no benefit.

## Diff computation (pure module)

New file `packages/analyzer/src/diff.ts`. Pure function — no IO, no HA, no SQLite. Input: snapshot + current analysis. Output: structured diff that the API surfaces and the UI renders.

```ts
export type DiffKind = 'added' | 'moved' | 'removed'

export interface EntityDiff {
  entityId: string
  kind: DiffKind
  // For 'moved' and 'removed': the room (or misc, encoded as null)
  // the entity occupied in the snapshot. Undefined for 'added'.
  previousRoomId?: CanonicalRoomId | null
  // For 'moved' and 'added': the room the entity is in now.
  // Undefined for 'removed' (entity is no longer in HA).
  currentRoomId?: CanonicalRoomId | null
}

export interface RoomDiffSummary {
  added: number       // entities new to this room (no prior assignment OR moved in)
  movedIn: number     // subset of added: was assigned to a different room
  movedOut: number    // entities that left this room (now elsewhere)
}

export interface DiffResult {
  entities: EntityDiff[]
  perRoom: Partial<Record<CanonicalRoomId, RoomDiffSummary>>
  totals: { added: number; moved: number; removed: number }
  appliedAt: number  // copied through from the snapshot
}

export function computeDiff(input: {
  snapshot: AppliedSnapshot
  current: { assignments: SnapshotAssignment[] }
}): DiffResult
```

**Algorithm:**

1. Build `prev: Map<entityId, roomId|null>` from `snapshot.assignments` and `curr: Map<entityId, roomId|null>` from current analysis.
2. For each entity in `curr` not in `prev` → `added` (no `previousRoomId`).
3. For each entity in `prev` not in `curr` → `removed` (entity gone from HA, no `currentRoomId`).
4. For each entity in both with differing `roomId` → `moved` (both ids set).
5. Entities in both with the same `roomId` are silent (not in `entities[]`).
6. Roll up per-room counts: for each `CanonicalRoomId` that has any activity, count `added` (kind=added with currentRoomId=room) + `movedIn` (kind=moved with currentRoomId=room) + `movedOut` (kind=moved with previousRoomId=room).

Misc-to-room and room-to-misc both surface as `moved` — `null` is just another assignment value in the comparison. The frontend formats "Moved from misc" / "Moved to misc" as user-friendly text.

Hidden/disabled entities aren't in the snapshot's assignments list (we capture only what was actually placed in views), so the diff doesn't surface override-driven hide/show toggles. Those are visible in the override UI already.

## API changes

Two routes touched, no new routes.

**POST /api/apply** — request body extended:

```ts
interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
  // NEW — optional, but always sent by the production frontend.
  snapshot?: {
    assignments: SnapshotAssignment[]
    config: LovelaceConfig
  }
}
```

Validation: a new zod schema in the route file (`SnapshotBodySchema`) checks `assignments` is an array of `{ entityId: string, roomId: enum(CANONICAL_ROOMS) | null }` and `config.title: string && config.views: array` (matching the existing config check). Server-side flow: push the dashboard first; on success, persist the snapshot. If snapshot validation fails, the push still succeeds but the response includes `snapshot_skipped: 'invalid'` so the user isn't blocked. Snapshot persistence errors (SQLite write fails) are caught and logged but also non-fatal — the apply itself succeeded; the response includes `snapshot_persisted: false`.

**Response shape additions:**

```ts
interface ApplyResponse extends ApplyDashboardResult {
  ok: true
  // NEW — only present if a snapshot field was sent and either rejected or failed to persist.
  snapshot_skipped?: 'invalid'
  snapshot_persisted?: false
}
```

When the snapshot persists successfully, neither field is set (default success path stays unchanged for clients that don't care).

**POST /api/preview** — response extended:

```ts
interface PreviewOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
  config: LovelaceConfig
  // NEW — null when no snapshot has ever been saved (first-run case).
  diff: DiffResult | null
}
```

The route loads `appliedSnapshotStore.get()`, builds the current snapshot-shaped assignments from the analysis output (one entity → its assigned room or null for misc), calls `computeDiff()`, and includes the result.

**Wiring:** `AppliedSnapshotStore` instance is constructed alongside `OverrideStore` and `InviteStore` (currently in the addon entry point and dev server) and threaded into both routes via DI. Tests instantiate the store with `:memory:`.

`POST /api/analyze` is left untouched — it's the lighter "no config build" endpoint and the diff doesn't add value there. The frontend uses `/api/preview` exclusively (per `useAnalyzeStore.analyze()`), so this is a no-op for the user flow.

## Frontend rendering

**Pinia store extension.** `useAnalyzeStore` already holds `preview: PreviewOutput | null`. Since `PreviewOutput` now carries `diff`, no new store is needed — `analyze.preview.diff` is the single source of truth. A computed helper `analyze.diff` returns it (or null) for ergonomic template binding.

**`DiffBanner.vue`** — rendered above `RoomList` in `App.vue`. Three states:

- `diff === null` → not rendered (first-run, before any apply has happened).
- `diff.totals` all zero → muted single-line: "No changes since last apply on May 1." Use relative date for "today" / "yesterday", absolute date otherwise.
- Any totals nonzero → pill row: `+5 added · ↻ 2 moved · ✗ 1 removed` with the apply timestamp on the right. Pill colors match the existing palette: green-100/800 for added, blue-100/800 for moved, red-100/800 for removed.

**Per-room badges in `RoomList.vue`.** Add a `diffByRoom` prop (`Partial<Record<CanonicalRoomId, RoomDiffSummary>>`). For each room, render a small badge group inside the existing room row's right-hand cluster, before the confidence pill: `+3 new · ↻ 1 moved`. Hidden when both counts are zero. The mapping is built once in `App.vue` from `diff.perRoom` to avoid re-derivation per row.

**Inline tags in `EntityRow.vue`.** Add a `diff: EntityDiff | undefined` prop. Renders a small tag next to the entity name when present:

- `kind: 'added'` → "New" (green pill).
- `kind: 'moved'` → "Moved from {previous}" where `{previous}` is rendered via the existing `roomIdToDisplay()` helper from `packages/web/src/rooms.ts` (canonical room display name), or the literal string "Misc" when `previousRoomId === null`. Blue pill.
- `kind: 'removed'` doesn't render here — removed entities aren't in `assignments[]`.

**`RemovedEntitiesPanel.vue`** — rendered below `DiffBanner` (or hidden when zero removed). Amber/red treatment to flag user attention. Lists each removed entity: `light.guest_lamp · was in Living Room`. The "was in" phrasing maps `previousRoomId` via the same `roomIdToDisplay()` helper as the inline tags (or "Misc" for null). Click does nothing — purely informational.

**Wiring in `App.vue`.** Above the existing `<RoomList>` block, add:

```vue
<DiffBanner v-if="analyze.preview" :diff="analyze.preview.diff" />
<RemovedEntitiesPanel
  v-if="analyze.preview?.diff && analyze.preview.diff.totals.removed > 0"
  :diff="analyze.preview.diff"
/>
<RoomList :rooms="analyze.preview.rooms" :diff-by-room="diffByRoom" />
```

Pass per-entity diffs into `<EntityRow>` from `RoomList.vue`'s assignment loop (`assignments` are already there; map by `entityId` against `diff.entities`).

## Edge cases & first-run handling

- **First-run (no snapshot ever saved).** `appliedSnapshotStore.get()` returns null → `PreviewOutput.diff = null` → `DiffBanner` and `RemovedEntitiesPanel` don't render → no per-room badges → no inline entity tags. The review screen looks identical to today. After the user clicks Apply for the first time, the snapshot persists, and the *next* analyze starts showing diffs. No banner explaining "this is your first analysis" — silence is the right UX (it appears when it has something to say).

- **No-change re-analyze.** Snapshot exists but nothing has shifted. `diff.totals` is `{added: 0, moved: 0, removed: 0}` and `diff.entities` is empty. `DiffBanner` renders the muted single-line "No changes since last apply on …". Per-room badges, inline tags, and `RemovedEntitiesPanel` all hidden.

- **Override edits between analyzes.** Saving an override fires a re-analyze (existing P1b-4 flow). The diff baseline is still the last-applied snapshot, so the diff updates live as the user edits — they can see the impact of their override before applying. This is a feature, not a bug: the user sees "if I apply this now, here's what will change".

- **Stale snapshot referencing entities that no longer exist in HA.** The diff handles it — those entities show up as `kind: 'removed'`. The previous-room display in `RemovedEntitiesPanel` reads from the snapshot, so a removed entity's last-known room survives. We use the canonical room display name (server-side render via the existing `CANONICAL_ROOM_NAMES` table) since the area name is unavailable for an entity that's gone from registry.

- **Snapshot referencing canonical roomIds that have since been retired.** Not a real risk — `CANONICAL_ROOMS` is a closed set in the codebase, only changes via code update. If a future code change drops a room, a separate migration handles it. YAGNI for now.

- **Apply succeeds but snapshot persistence fails** (SQLite disk full, etc.). Apply route catches the persistence error, logs it via `req.log.error`, and returns `200 ok` with the existing `ApplyDashboardResult` plus `snapshot_persisted: false`. The dashboard is live in HA either way; the next apply will overwrite the failed write attempt or succeed fresh. No user-facing alert — the "Dashboard X created" toast still shows.

- **Snapshot validation fails on apply** (frontend bug, malformed snapshot). Same idea: apply succeeds, snapshot rejected with `snapshot_skipped: 'invalid'` + log. User-facing flow unaffected.

- **Concurrent applies.** Fastify processes one request at a time per connection; there's no actual concurrency to worry about. Even if two clients applied simultaneously, `INSERT OR REPLACE` wins last-write — both diffs would be valid baselines.

## Testing strategy

**`packages/analyzer/src/__tests__/diff.test.ts`** — pure-function tests, no fixtures needed:

- Empty snapshot vs empty current → all-zero diff, no entities.
- Added: entity in current but not snapshot → `kind: 'added'`, `currentRoomId` set, no `previousRoomId`.
- Removed: entity in snapshot but not current → `kind: 'removed'`, `previousRoomId` set, no `currentRoomId`.
- Moved between two rooms → `kind: 'moved'`, both ids set.
- Moved misc → room and room → misc → both `kind: 'moved'` with null on the appropriate side.
- Per-room rollup: 3 rooms with mixed adds/moves, verify counts add up.
- Same entity in same room → silent (not in `entities[]`).
- Idempotence: running on identical snapshot/current → empty diff.

**`packages/server/src/storage/__tests__/applied-snapshot-store.test.ts`** — using `:memory:` DB, mirrors `OverrideStore` test shape:

- Initial `get()` returns null.
- `save()` then `get()` returns equivalent shape with `appliedAt` set to a recent unix timestamp.
- `save()` twice — second overwrites first (last write wins).
- JSON round-trip preserves shape across various `assignments` and `config` payloads.
- Constructor creates parent dir for file paths.

**`packages/server/src/__tests__/routes/apply.test.ts`** — extends existing apply route tests:

- Body with valid `snapshot` → snapshot persisted (`store.get()` returns the saved value), `200 ok`.
- Body without `snapshot` → push succeeds, `store.get()` still returns null (no write).
- Body with malformed `snapshot` → push succeeds, response includes `snapshot_skipped: 'invalid'`, `store.get()` returns null.
- Apply fails (HA error) → snapshot NOT persisted (the existing 502 path runs unchanged).

**`packages/server/src/__tests__/routes/preview.test.ts`** — extends existing preview tests:

- No snapshot present → response `diff: null`.
- Snapshot present matching current analysis → `diff.totals` all zero, `entities: []`.
- Snapshot present with one removed entity → `diff.totals.removed === 1` and the entity appears in `diff.entities`.

**`packages/web/src/__tests__/components/DiffBanner.test.ts`** — three render branches: null diff (not rendered), all-zero diff (muted line), nonzero diff (pill row with correct counts and apply-timestamp formatting).

**`packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts`** — renders entries when `diff.totals.removed > 0`, hidden otherwise; previous-room display works for both canonical rooms and `null` (misc).

**Existing test extensions.** `RoomList.test.ts` and `EntityRow.test.ts` get new cases for the diff prop branches. `App.test.ts` integration test gains a "preview returns diff → banner + badges + tags rendered" case.

**Manual smoke test (per ROADMAP DoD).** Spin dev HA, apply an initial dashboard, add 5 entities to dev HA's fixture, re-analyze → verify the AC: "5 additions in correct rooms" by visually scanning per-room badges and entity tags. Then remove an entity from the dev HA registry and re-analyze → verify "removed entity warning shown" by checking `RemovedEntitiesPanel` lists it.

## Out of scope (deferred)

- **Diff history.** Only the last-applied snapshot is retained. P2-1 doesn't show "what changed two applies ago". A history table would be straightforward to add later (drop the `CHECK (id = 1)` constraint, add an apply-id index) — but YAGNI for closed beta.
- **YAML drift detection.** We persist the full `LovelaceConfig` for archival, but P2-1 doesn't compare it against what's currently in HA. The config column is the substrate for a future "the user edited the dashboard manually since you applied" feature; nothing reads it yet.
- **Per-card diffs.** A diff is per-entity, not per-card-property. If the user changes a tile to a thermostat card via override (future feature), that re-renders silently.
- **Diff suppression for trivial changes.** All structural changes are surfaced. Future P2-5 (suggestions panel) may add UI to dismiss diffs, but P2-1 is read-only.
- **Confidence-change tracking.** An entity's confidence going from 0.6 to 0.9 isn't surfaced — only room reassignment matters.

## File summary

**New:**

- `packages/analyzer/src/diff.ts`
- `packages/analyzer/src/__tests__/diff.test.ts`
- `packages/server/src/storage/applied-snapshot-store.ts`
- `packages/server/src/storage/__tests__/applied-snapshot-store.test.ts`
- `packages/web/src/components/DiffBanner.vue`
- `packages/web/src/components/RemovedEntitiesPanel.vue`
- `packages/web/src/__tests__/components/DiffBanner.test.ts`
- `packages/web/src/__tests__/components/RemovedEntitiesPanel.test.ts`

**Modified:**

- `packages/analyzer/src/index.ts` — re-export `computeDiff`, types
- `packages/shared/src/types.ts` — `SnapshotAssignment`, `AppliedSnapshot`, `EntityDiff`, `DiffResult`, `RoomDiffSummary` (any types crossing the API boundary)
- `packages/server/src/pipeline.ts` — `runPreview()` loads snapshot + computes diff; `PreviewOutput` gains `diff`
- `packages/server/src/routes/apply.ts` — accept + validate `snapshot`, persist after success, surface `snapshot_skipped` / `snapshot_persisted: false`
- `packages/server/src/routes/preview.ts` — pass snapshot store into pipeline call (or directly via DI)
- `packages/server/src/app.ts` — register `AppliedSnapshotStore` in DI options
- `apps/addon/src/server.ts` (or wherever stores are constructed) — instantiate `AppliedSnapshotStore`
- `packages/web/src/api/types.ts` — `PreviewOutput.diff`, snapshot/diff types mirrored
- `packages/web/src/api/client.ts` — `postApply` accepts optional snapshot field
- `packages/web/src/stores/apply.ts` — pass snapshot field through to `postApply`
- `packages/web/src/components/ApplyBar.vue` — derive snapshot from `analyze.preview` and pass to `apply.apply()`
- `packages/web/src/components/RoomList.vue` — `diffByRoom` prop, badge rendering
- `packages/web/src/components/EntityRow.vue` — `diff` prop, inline tag rendering
- `packages/web/src/App.vue` — wire `DiffBanner`, `RemovedEntitiesPanel`, `diffByRoom` map
