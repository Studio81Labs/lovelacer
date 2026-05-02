# P2-5 — Suggestions Panel (Lite) — Design

**Status:** Draft v1 · **Date:** 2026-05-02 · **Phase:** 2 (Polish & Release) · **Sizing:** M

## Goal

Surface three actionable suggestions to help users polish their detection results: "Set area_id in HA" (entity has no area but we matched it via name patterns), "Move to better room" (low-confidence assignment with a close runner-up), "Hide diagnostic" (auto-generated diagnostic entities cluttering the dashboard). Each suggestion has Accept and Dismiss buttons; dismissals persist across runs.

**Acceptance criteria** (from ROADMAP.md):

- Suggestions appear when fixtures match conditions.
- Dismiss persists across runs.
- Accept applies as override.

## Context

Phase 2 ticket 5. Phase 2 has shipped P2-1 (re-analysis diff view), P2-2 (YAML export), P2-3 (floor-aware grouping), and P2-4 (misc bucket bulk UX). Sizing per ROADMAP: M (~2-3 evenings).

The analyzer already emits `RoomAssignment[]` with `confidence: number` + `signals: DetectionSignal[]` per entity — the hooks for low-confidence detection. `NormalizedEntity.entityCategory: 'diagnostic' | 'config' | null` already flags diagnostic entities directly. `HaClient` has no registry-write method, so the `set_area_id` Accept verb is a deep-link to HA's settings UI rather than a write-back via WebSocket — keeps scope contained and avoids adding a new HA-write trust boundary.

Existing override infrastructure (P1b-3 / P1b-4 / P2-4) is the foundation: Accept on `move_room` calls `overrides.setRoomId`, Accept on `hide_diagnostic` calls `overrides.setHidden`. The user clicks Save on the existing `OverridesBar` to commit. Suggestion state lives in a new SQLite table; the Pinia layer adds a thin in-flight + optimistic-dismissed shim.

## Architecture & data flow

Five pieces, layered cleanly:

1. **Detector returns top-N candidates** (`packages/analyzer/src/detect.ts`). The current detector returns `RoomAssignment` with a single `roomId` + confidence. The change is additive: `RoomAssignment` gets an optional `alternatives?: AlternativeAssignment[]` field carrying the next 2 candidates that scored above threshold. Existing callers ignore the field; the suggestion engine reads it.

2. **Pure suggestion engine** (`packages/analyzer/src/suggestions.ts`). Pure function `computeSuggestions({ rooms, miscEntityIds, entitiesById, overridesById, dismissed })` returns `Suggestion[]`. Walks every entity, applies the three rules, filters out anything in the dismissed set, returns sorted output. No IO. Re-exported from `@lovelacer/analyzer`.

3. **`DismissedSuggestionStore` SQLite table** (`packages/server/src/storage/dismissed-suggestion-store.ts`). Multi-row table keyed `(entity_id, suggestion_type)` + `dismissed_at` timestamp. Mirrors the existing `OverrideStore` pattern.

4. **Server pipeline + new endpoint** (`packages/server/src/pipeline.ts` + `packages/server/src/routes/suggestions.ts`):
   - `runPreview` adds `suggestions: Suggestion[]` to its `PreviewOutput`.
   - New `POST /api/suggestions/dismiss` endpoint: body `{ entityId, suggestionType }`, persists via the new store, returns `{ ok: true }`.

5. **Frontend**:
   - New `SuggestionsPanel.vue` rendered between `RemovedEntitiesPanel` and `RoomList`.
   - `useSuggestionsStore` Pinia store: holds in-flight dismissal call state + optimistic-dismissed set.
   - **Accept verb dispatch** lives in the panel:
     - `set_area_id` → `window.open('/config/entities?entity_id=...', '_blank')`. No store change.
     - `move_room` → `useOverridesStore.setRoomId(entity, suggestedRoom)`. Suggestion disappears next analyze (entity now has a manual override → confidence 1.0 → rule no longer fires).
     - `hide_diagnostic` → `useOverridesStore.setHidden(entity, true)`. Suggestion disappears next analyze (rule's "is not already hidden" check fails).

Suggestion lifecycle:

- Accepted (move/hide): override staged → Save in OverridesBar → re-analyze → suggestion gone.
- Accepted (set_area_id): user navigates to HA → comes back → Dismiss to silence (we can't tell from outside whether they actually set the area).
- Dismissed: persisted in DB → server filters from next preview's `suggestions[]`.

## Detection rules

```ts
type SuggestionType = 'set_area_id' | 'move_room' | 'hide_diagnostic'

interface Suggestion {
  entityId: string
  type: SuggestionType
  /** Brief user-facing prose. Localizable later (P2-9). */
  message: string
  /** For move_room: the suggested target room (top-2 candidate). Absent for the other types. */
  suggestedRoomId?: CanonicalRoomId
  /** For set_area_id: the canonical room ID we matched (used for the deep-link + display). Absent otherwise. */
  matchedRoomId?: CanonicalRoomId
}
```

**Rule 1 — `set_area_id`** (entity is detected via name patterns but has no HA area):

- `entity.haAreaId === null && (entity.device?.haAreaId ?? null) === null`
- `assignment.roomId !== 'misc'` (we found a room via name signals)
- `assignment.confidence >= 0.6` (we're reasonably sure)
- The dominant signal source (highest weight in `assignment.signals`) is one of: `'friendly_name' | 'entity_id' | 'device_name'` (NOT `'entity_area' | 'device_area' | 'override'` — those mean HA already has the data)
- Message: `"This entity has no area set in HA. Detected via its name. Set the area in HA so the assignment is permanent."`
- `matchedRoomId` = the assigned room.

**Rule 2 — `move_room`** (low-confidence assignment with a close runner-up):

- `assignment.roomId !== 'misc'`
- `assignment.confidence < 0.5`
- `assignment.alternatives` exists, has at least one entry, AND `alternatives[0].confidence > assignment.confidence - 0.15` (close call)
- The user has not already overridden this entity (no override OR override has no `roomId` set)
- Message: `"Low-confidence assignment (NN%). Consider moving to a different room."` (where NN is the rounded confidence percentage)
- `suggestedRoomId` = `alternatives[0].roomId`.

**Rule 3 — `hide_diagnostic`** (diagnostic entity not already hidden):

- `entity.entityCategory === 'diagnostic'`
- `entity.isHidden === false`
- The user has not already explicitly hidden it via override (no override row with `hidden: true`)
- Emitted regardless of misc status — accepting Hide on a misc entity still affects the bulk-bucket count.
- Message: `"Diagnostic entity. Hide from the dashboard?"`

Cross-cutting filter (after rules): drop any suggestion whose `(entityId, type)` is in the dismissed-suggestions store. Sorting: by `entityId` ascending, then by `type` ascending. Cap: no cap — realistic max is ~50 across the three types on a 500-entity install.

## Detector top-N change

Surgical change to `packages/analyzer/src/detect.ts`. The detector currently scores every canonical room for an entity and returns the winner. The change: return the top 2 alternatives alongside the winner.

**Type changes** in `packages/shared/src/types.ts`:

```ts
export interface RoomAssignment {
  entityId: string
  roomId: CanonicalRoomId
  confidence: number
  signals: DetectionSignal[]
  manual?: boolean
  /**
   * P2-5 — top-N candidates with score >= threshold (excluding the
   * winner). Used by the suggestions engine to surface "consider X
   * instead" prompts. Empty when no other room scored above threshold.
   * Capped at 2 entries to avoid noise.
   */
  alternatives?: AlternativeAssignment[]
}

export interface AlternativeAssignment {
  roomId: CanonicalRoomId
  confidence: number
}
```

**Detector code change** — after the existing scoring loop:

```ts
const sorted = [...scoreMap.entries()].sort((a, b) => b[1] - a[1])
const [winnerEntry, ...rest] = sorted
const winner = winnerEntry !== undefined ? winnerEntry[0] : 'misc'
const winnerScore = winnerEntry?.[1] ?? 0

const ALTERNATIVE_THRESHOLD = 0.2
const ALTERNATIVE_LIMIT = 2
const alternatives: AlternativeAssignment[] = rest
  .filter(([roomId, score]) => roomId !== 'misc' && score >= ALTERNATIVE_THRESHOLD)
  .slice(0, ALTERNATIVE_LIMIT)
  .map(([roomId, confidence]) => ({ roomId, confidence }))

return {
  entityId: entity.entityId,
  roomId: winner,
  confidence: winnerScore,
  signals,
  ...(alternatives.length > 0 ? { alternatives } : {}),
}
```

`ALTERNATIVE_THRESHOLD = 0.2` keeps noise out. `ALTERNATIVE_LIMIT = 2` is plenty (the suggestion engine only reads `alternatives[0]`; capping at 2 is generous-but-bounded). The `...(alternatives.length > 0 ? { alternatives } : {})` spread keeps `exactOptionalPropertyTypes` happy — when there are no alternatives, the field is omitted entirely (not set to `[]`).

**No behavior change for existing consumers.** They read `roomId` / `confidence` / `signals` as before. The new field is purely additive.

## Suggestion engine

`packages/analyzer/src/suggestions.ts`:

```ts
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  NormalizedEntity,
  Override,
  RoomAssignment,
  Suggestion,
  SuggestionType,
} from '@lovelacer/shared'

export interface ComputeSuggestionsInput {
  rooms: AnalyzedRoom[]
  miscEntityIds: Set<string>
  entitiesById: Map<string, NormalizedEntity>
  overridesById: Map<string, Override>
  /** Serialized "entityId|type" keys for O(1) lookup. */
  dismissed: Set<string>
}

export function computeSuggestions(input: ComputeSuggestionsInput): Suggestion[] {
  const out: Suggestion[] = []

  for (const room of input.rooms) {
    if (room.id === 'misc') continue
    for (const a of room.assignments) {
      const entity = input.entitiesById.get(a.entityId)
      if (entity === undefined) continue
      const override = input.overridesById.get(a.entityId)

      const setArea = trySetAreaIdSuggestion(a, entity)
      if (setArea !== null && !isDismissed(input.dismissed, setArea)) out.push(setArea)

      const moveRoom = tryMoveRoomSuggestion(a, override)
      if (moveRoom !== null && !isDismissed(input.dismissed, moveRoom)) out.push(moveRoom)

      const hideDiag = tryHideDiagnosticSuggestion(entity, override)
      if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
    }
  }

  // Diagnostic suggestions also apply to misc entities.
  for (const entityId of input.miscEntityIds) {
    const entity = input.entitiesById.get(entityId)
    if (entity === undefined) continue
    const override = input.overridesById.get(entityId)
    const hideDiag = tryHideDiagnosticSuggestion(entity, override)
    if (hideDiag !== null && !isDismissed(input.dismissed, hideDiag)) out.push(hideDiag)
  }

  out.sort((a, b) => {
    const cmp = a.entityId.localeCompare(b.entityId, 'en')
    if (cmp !== 0) return cmp
    return a.type.localeCompare(b.type, 'en')
  })

  return out
}

function isDismissed(set: Set<string>, s: Suggestion): boolean {
  return set.has(`${s.entityId}|${s.type}`)
}

const NAME_BASED_SOURCES = new Set(['friendly_name', 'entity_id', 'device_name'])

function trySetAreaIdSuggestion(a: RoomAssignment, entity: NormalizedEntity): Suggestion | null {
  if (entity.haAreaId !== null) return null
  if ((entity.device?.haAreaId ?? null) !== null) return null
  if (a.confidence < 0.6) return null
  const dominant = [...a.signals].sort((x, y) => y.weight - x.weight)[0]
  if (dominant === undefined || !NAME_BASED_SOURCES.has(dominant.source)) return null
  return {
    entityId: a.entityId,
    type: 'set_area_id',
    matchedRoomId: a.roomId,
    message: `This entity has no area set in HA. Detected via its name. Set the area in HA so the assignment is permanent.`,
  }
}

function tryMoveRoomSuggestion(
  a: RoomAssignment,
  override: Override | undefined,
): Suggestion | null {
  if (a.confidence >= 0.5) return null
  if (override?.roomId !== undefined) return null
  const alt = a.alternatives?.[0]
  if (alt === undefined) return null
  if (alt.confidence <= a.confidence - 0.15) return null
  return {
    entityId: a.entityId,
    type: 'move_room',
    suggestedRoomId: alt.roomId,
    message: `Low-confidence assignment (${Math.round(a.confidence * 100)}%). Consider moving to a different room.`,
  }
}

function tryHideDiagnosticSuggestion(
  entity: NormalizedEntity,
  override: Override | undefined,
): Suggestion | null {
  if (entity.entityCategory !== 'diagnostic') return null
  if (entity.isHidden) return null
  if (override?.hidden === true) return null
  return {
    entityId: entity.entityId,
    type: 'hide_diagnostic',
    message: `Diagnostic entity. Hide from the dashboard?`,
  }
}
```

Re-exported from `packages/analyzer/src/index.ts` alongside `assignFloors`, `computeDiff`, etc.

## DismissedSuggestionStore

`packages/server/src/storage/dismissed-suggestion-store.ts`:

```sql
CREATE TABLE IF NOT EXISTS dismissed_suggestions (
  entity_id       TEXT    NOT NULL,
  suggestion_type TEXT    NOT NULL,
  dismissed_at    INTEGER NOT NULL DEFAULT (unixepoch()),
  PRIMARY KEY (entity_id, suggestion_type)
);
```

Class API mirrors `OverrideStore`/`InviteStore`/`AppliedSnapshotStore`:

```ts
export class DismissedSuggestionStore {
  constructor(filename: string)
  /** Returns dismissals as a Set of "entityId|type" keys for O(1) lookup. */
  getAllAsKeySet(): Set<string>
  dismiss(entityId: string, type: SuggestionType): void
  close(): void
}
```

`INSERT OR REPLACE` makes `dismiss` idempotent (re-dismissing updates the timestamp). `getAllAsKeySet()` returns the same shape the suggestion engine expects, so no in-pipeline transformation needed. Constructor accepts `':memory:'` for tests, otherwise creates parent dir via `mkdirSync(dirname, { recursive: true })`. Pragma `journal_mode = WAL`. Prepared statements hoisted in the constructor.

`main.ts` instantiates the store at the same SQLite file path as the others (`config.dataDir + '/lovelacer.sqlite'`).

## API + persistence wiring

**`PreviewOutput.suggestions: Suggestion[]`** — required field on the existing preview response. Empty array when no suggestions.

**Pipeline change** in `runPreview`:

```ts
const dismissed = state.dismissedSuggestions ?? new Set<string>()
const overridesById = new Map<string, Override>()
for (const o of overrides.getAll()) overridesById.set(o.entityId, o)
const entitiesById = new Map<string, NormalizedEntity>()
for (const e of state.entities) entitiesById.set(e.entityId, e)
const miscEntityIds = new Set(state.misc.map((m) => m.entityId))

const suggestions = computeSuggestions({
  rooms: state.rooms,
  miscEntityIds,
  entitiesById,
  overridesById,
  dismissed,
})
```

`PipelineState` adds `dismissedSuggestions: Set<string>` (loaded from the new store at the top of `runFullPipeline`).

**`POST /api/suggestions/dismiss`** — new route in `packages/server/src/routes/suggestions.ts`:

```ts
const SUGGESTION_TYPES = ['set_area_id', 'move_room', 'hide_diagnostic'] as const

const DismissBodySchema = z.object({
  entityId: z.string().min(1).max(255),
  suggestionType: z.enum(SUGGESTION_TYPES),
})

export const suggestionsRoute: FastifyPluginAsync<SuggestionsRouteOptions> = async (app, opts) => {
  app.post('/api/suggestions/dismiss', async (req, reply) => {
    const parsed = DismissBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: 'entityId and suggestionType required',
      })
    }
    try {
      opts.dismissed.dismiss(parsed.data.entityId, parsed.data.suggestionType)
      return reply.code(200).send({ ok: true })
    } catch (err) {
      req.log.error({ err }, 'dismiss suggestion failed')
      return reply.code(500).send({
        error: 'storage_error',
        message: String(err),
      })
    }
  })
}
```

`CreateAppOptions` adds `dismissedSuggestions: DismissedSuggestionStore`. Route registered between `applyRoute` and `exportRoute` in `app.ts`. Invite gate (P1b-6) blocks `/api/suggestions/dismiss` like every other `/api/*` path until invite acceptance.

## Frontend

**Type mirror** in `packages/web/src/api/types.ts`:

```ts
export type SuggestionType = 'set_area_id' | 'move_room' | 'hide_diagnostic'

export interface Suggestion {
  entityId: string
  type: SuggestionType
  message: string
  /** For move_room only. Widened to string to match the web type-isolation convention. */
  suggestedRoomId?: string
  /** For set_area_id only. */
  matchedRoomId?: string
}
```

`PreviewOutput.suggestions: Suggestion[]` — required field.

**API client** (`packages/web/src/api/client.ts`):

```ts
export interface DismissSuggestionInput {
  entityId: string
  suggestionType: SuggestionType
}

export async function postDismissSuggestion(input: DismissSuggestionInput): Promise<void> {
  const res = await fetch('api/suggestions/dismiss', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(input),
  })
  if (!res.ok) throw await readApiError(res)
}
```

`'api/suggestions/dismiss'` (no leading slash) — document-relative for ingress compatibility.

**`useSuggestionsStore`** (`packages/web/src/stores/suggestions.ts`):

```ts
export const useSuggestionsStore = defineStore('suggestions', () => {
  const phase = ref<'idle' | 'dismissing' | 'error'>('idle')
  const error = ref<ApiError | null>(null)
  const optimisticallyDismissed = ref<Set<string>>(new Set())

  function isDismissed(entityId: string, type: SuggestionType): boolean {
    return optimisticallyDismissed.value.has(`${entityId}|${type}`)
  }

  async function dismiss(entityId: string, type: SuggestionType): Promise<void> {
    phase.value = 'dismissing'
    error.value = null
    try {
      await postDismissSuggestion({ entityId, suggestionType: type })
      const next = new Set(optimisticallyDismissed.value)
      next.add(`${entityId}|${type}`)
      optimisticallyDismissed.value = next
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  function reset(): void {
    optimisticallyDismissed.value = new Set()
    phase.value = 'idle'
    error.value = null
  }

  return { phase, error, optimisticallyDismissed, isDismissed, dismiss, reset }
})
```

`App.vue` adds `watch(() => analyze.preview, () => suggestions.reset())` so the optimistic-dismissed set clears whenever a fresh preview lands. The server's `suggestions[]` is then authoritative.

**`SuggestionsPanel.vue`** — new component, rendered between `RemovedEntitiesPanel` and `RoomList`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useOverridesStore } from '../stores/overrides.js'
import { useSuggestionsStore } from '../stores/suggestions.js'
import { roomIdToDisplay } from '../rooms.js'
import type { Suggestion } from '../api/types.js'

const props = defineProps<{ suggestions: Suggestion[] }>()
const overrides = useOverridesStore()
const suggestionsStore = useSuggestionsStore()

const visible = computed(() =>
  props.suggestions.filter((s) => !suggestionsStore.isDismissed(s.entityId, s.type)),
)

function accept(s: Suggestion): void {
  if (s.type === 'set_area_id') {
    // Host-rooted absolute path: navigates to HA's entity settings even
    // when the SPA is served under add-on ingress at
    // /api/hassio_ingress/<token>/. Opens in a new tab so the user
    // can return to the analyze view.
    window.open(`/config/entities?entity_id=${encodeURIComponent(s.entityId)}`, '_blank')
    return
  }
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    overrides.setRoomId(s.entityId, s.suggestedRoomId)
    return
  }
  if (s.type === 'hide_diagnostic') {
    overrides.setHidden(s.entityId, true)
    return
  }
}

async function dismiss(s: Suggestion): Promise<void> {
  await suggestionsStore.dismiss(s.entityId, s.type)
}

function suggestedLabel(s: Suggestion): string {
  if (s.type === 'move_room' && s.suggestedRoomId !== undefined) {
    return roomIdToDisplay(s.suggestedRoomId)
  }
  if (s.type === 'set_area_id' && s.matchedRoomId !== undefined) {
    return roomIdToDisplay(s.matchedRoomId)
  }
  return ''
}

function acceptLabel(s: Suggestion): string {
  if (s.type === 'set_area_id') return 'Open HA settings'
  if (s.type === 'move_room') return `Move to ${suggestedLabel(s)}`
  return 'Hide'
}
</script>

<template>
  <section
    v-if="visible.length > 0"
    data-testid="suggestions-panel"
    class="rounded-lg border border-stone-200 bg-white px-5 py-3 text-sm"
  >
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      {{ visible.length }} suggestion{{ visible.length === 1 ? '' : 's' }}
    </h3>
    <ul class="space-y-2">
      <li
        v-for="s in visible"
        :key="`${s.entityId}|${s.type}`"
        data-testid="suggestion-card"
        class="flex items-center gap-3 rounded border border-stone-100 bg-stone-50/50 px-3 py-2 text-xs"
      >
        <div class="min-w-0 flex-1">
          <span class="font-mono text-stone-700">{{ s.entityId }}</span>
          <p class="mt-0.5 text-stone-600">{{ s.message }}</p>
        </div>
        <button
          type="button"
          data-testid="suggestion-accept"
          class="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="accept(s)"
        >
          {{ acceptLabel(s) }}
        </button>
        <button
          type="button"
          data-testid="suggestion-dismiss"
          class="rounded border border-stone-300 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
          :disabled="suggestionsStore.phase === 'dismissing'"
          @click="dismiss(s)"
        >
          Dismiss
        </button>
      </li>
    </ul>
  </section>
</template>
```

`App.vue` template addition between `RemovedEntitiesPanel` and `RoomList`:

```vue
<SuggestionsPanel v-if="analyze.preview" :suggestions="analyze.preview.suggestions" />
```

**Per-card disable rationale.** The `phase === 'dismissing'` guard prevents double-clicks during the in-flight POST. If the user clicks Accept on a `move_room` (which calls `overrides.setRoomId` synchronously), no POST fires, and `phase` stays `'idle'` — Accept buttons stay enabled across cards. The disable only triggers during the actual server round-trip for Dismiss. While one card's Dismiss is in flight, every other card's Dismiss/Accept is locked. For the few-second round-trip on a slow connection, this is conservative-but-safe — better than letting two POSTs interleave.

## Edge cases & error handling

- **Re-analyze drops a previously-suggested entity from the analyzer's output entirely** (e.g., entity removed from HA). The next preview's `suggestions[]` doesn't contain it. The optimistic-dismissed store may still hold the stale key — harmless. Server-side dismissal still applies if the entity returns later.
- **Dismissing while offline / 503.** `postDismissSuggestion` rejects. Store's `phase` becomes `'error'`. UI doesn't add the key to `optimisticallyDismissed`. Dismiss button re-enables. User can retry. The thrown error is NOT surfaced via a toast in this lite version — user just sees the suggestion remain visible. P3 polish can add toast-on-error.
- **User accepts `move_room`, edits the override back to the original room, hits Save.** Override store collapses to "no change". Save is a no-op. Re-analyze fires anyway. Suggestion fires again (low-confidence assignment unchanged). User can dismiss explicitly.
- **User accepts `move_room`, dismisses the same suggestion, hits Save.** Accept stages override → Dismiss POSTs persistence → Save commits override. Next analyze: rule no longer fires (manual override → confidence 1.0). Dismissal persists for the key but is moot. Harmless.
- **Hidden override AND `hide_diagnostic` suggestion both apply.** Can't happen — rule explicitly skips when `override?.hidden === true`.
- **Two suggestions for the same entity, different types.** A diagnostic entity in a low-confidence assignment with no HA area gets all three. Panel renders three cards. Each independently Accept/Dismiss-able. Sort puts them adjacent.
- **Suggestion engine cost.** O(n) walk over all assigned + misc entities. Set lookup is O(1). Sub-millisecond for typical installs.
- **Detector `alternatives` field interaction with the diff (P2-1).** Diff operates on entity → roomId mappings; alternatives are runtime-only, not persisted. No diff regression.
- **Race: user clicks Dismiss during in-flight re-analyze.** New analyze pulls fresh `suggestions[]` (server filters via persisted dismissal). Optimistic-dismissed clears via `watch(analyze.preview)` reset. Idempotent.
- **Dismissal store grows unbounded.** A user dismissing 200 suggestions accumulates 200 rows. SQLite handles trivially. No GC. Future polish: clean up rows whose entityId isn't in current registry. Out of scope for the lite ticket.
- **YAML export (P2-2).** None. Suggestions are SPA-only metadata, never serialized into the config.
- **Apply (P1a-8).** None. Suggestions live entirely on the analyze surface — they don't propagate into the config push.
- **Floor section (P2-3).** None. Floor data is presentational; suggestions are independent.
- **Misc bucket (P2-4).** A misc diagnostic entity gets a `hide_diagnostic` suggestion. Bulk UX still works in parallel; suggestions are an alternative one-click flow for diagnostics specifically.

## Testing strategy

**`packages/analyzer/src/__tests__/detect.test.ts`** — extends with top-N coverage:

- Strong dominant signal → `alternatives` field omitted entirely.
- Multiple rooms scoring close → `alternatives` populated, sorted descending.
- Cap at 2 entries: 4 candidates above threshold → only top 2 in array.
- Misc never appears in alternatives.

**`packages/analyzer/src/__tests__/suggestions.test.ts`** — pure-function tests:

- Empty input → empty output.
- Each rule isolated (positive + negative cases per rule):
  - `set_area_id` happy path; rejection on `entity_area` dominant signal; rejection on confidence < 0.6; rejection on existing haAreaId; rejection on device.haAreaId.
  - `move_room` happy path; rejection on confidence ≥ 0.5; rejection on no alternatives; rejection on alternatives gap > 0.15; rejection on existing override.
  - `hide_diagnostic` happy path; rejection on non-diagnostic; rejection on `entity.isHidden === true`; rejection on existing hidden override.
- Dismissed-set filter: a suggestion that would emit, with its key in dismissed → not in output.
- Sort order: 3 suggestions across 2 entities → output sorted by entityId then type.
- Misc-entity diagnostic: misc entity with `entityCategory: 'diagnostic'` → emits `hide_diagnostic`.

**`packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts`** — using `:memory:` DB:

- Initial `getAllAsKeySet()` returns empty Set.
- `dismiss(id, type)` then `getAllAsKeySet()` contains the key.
- `dismiss` twice with the same args → idempotent.
- Constructor creates parent directory for file paths.

**`packages/server/src/__tests__/routes/suggestions.test.ts`** — `app.inject`-based:

- Valid body → 200 `{ ok: true }`, store has the entry.
- Missing entityId → 400 `invalid_body`.
- Invalid `suggestionType` → 400 `invalid_body`.

**`packages/server/src/__tests__/routes/invite-gate.test.ts`** — extends:

- Invite gate blocks `POST /api/suggestions/dismiss` with 403 `invite_required` when not accepted.

**`packages/server/src/__tests__/routes/preview.test.ts`** — extends:

- Fixture with a `set_area_id` candidate → response `suggestions[]` contains the entry.
- Dismiss the suggestion via the store, then preview → response `suggestions[]` does NOT contain it.

**`packages/web/src/__tests__/api/client.test.ts`** — extends:

- `postDismissSuggestion` posts to `'api/suggestions/dismiss'` (no leading slash) with the right body.
- 4xx response → throws `ApiError`.

**`packages/web/src/__tests__/stores/suggestions.test.ts`** — new file:

- Initial state.
- `dismiss` happy path: phase idle, key added.
- `dismiss` failure: phase error, key NOT added (suggestion stays visible).
- `isDismissed` returns true after success.
- `reset()` clears optimistic set + error.

**`packages/web/src/__tests__/components/SuggestionsPanel.test.ts`** — new file:

- Empty `suggestions` prop → component renders nothing.
- One of each type → 3 cards with right `acceptLabel`.
- Click Accept on `set_area_id` → `window.open` called with the right URL + `'_blank'`.
- Click Accept on `move_room` → `useOverridesStore.setRoomId` called.
- Click Accept on `hide_diagnostic` → `useOverridesStore.setHidden` called.
- Click Dismiss → `useSuggestionsStore.dismiss` called.
- After successful Dismiss → card disappears (re-query DOM).
- During `phase === 'dismissing'` → both buttons disabled.

**`packages/web/src/__tests__/App.test.ts`** — extends:

- Preview returns 2 suggestions → SuggestionsPanel renders 2 cards.
- After re-analyze (via `$patch`), `useSuggestionsStore.optimisticallyDismissed.size === 0`.

**Manual smoke (per ROADMAP DoD):**

1. Spin dev HA. Ensure the fixture has at least:
   - One entity with `entityCategory: 'diagnostic'` (e.g., a battery sensor).
   - One entity with no `area_id` but a friendly name matching a room ("Living Room Lamp" with no area).
   - One entity with low-confidence detection + a close runner-up (test fixture with conflicting name signals).
2. Analyze → suggestions panel appears with cards for each.
3. Click "Open HA settings" on a `set_area_id` card → new tab opens to HA's entity-config page. Set the area in HA → close tab → re-analyze → suggestion gone.
4. Click "Move to <Room>" on a `move_room` card → OverridesBar shows `+1 pending change`. Save → re-analyze → suggestion gone.
5. Click "Hide" on a `hide_diagnostic` card → OverridesBar shows `+1 pending change`. Save → re-analyze → suggestion gone.
6. Dismiss any suggestion → card disappears immediately. Re-analyze → suggestion still absent. Restart dev server → re-analyze → still absent (DB persistence).

## File summary

**New:**

- `packages/analyzer/src/suggestions.ts`
- `packages/analyzer/src/__tests__/suggestions.test.ts`
- `packages/server/src/storage/dismissed-suggestion-store.ts`
- `packages/server/src/storage/__tests__/dismissed-suggestion-store.test.ts`
- `packages/server/src/routes/suggestions.ts`
- `packages/server/src/__tests__/routes/suggestions.test.ts`
- `packages/web/src/stores/suggestions.ts`
- `packages/web/src/__tests__/stores/suggestions.test.ts`
- `packages/web/src/components/SuggestionsPanel.vue`
- `packages/web/src/__tests__/components/SuggestionsPanel.test.ts`

**Modified:**

- `packages/shared/src/types.ts` — add `Suggestion`, `SuggestionType`, `AlternativeAssignment`; extend `RoomAssignment` with `alternatives?`
- `packages/analyzer/src/detect.ts` — emit top-N alternatives
- `packages/analyzer/src/index.ts` — re-export `computeSuggestions`, `ComputeSuggestionsInput`
- `packages/analyzer/src/__tests__/detect.test.ts` — extend with alternatives coverage
- `packages/server/src/pipeline.ts` — load dismissed set, compute suggestions, attach to PreviewOutput
- `packages/server/src/app.ts` — register `suggestionsRoute`, add `dismissedSuggestions` to `CreateAppOptions`
- `packages/server/src/main.ts` — instantiate `DismissedSuggestionStore`, close on shutdown
- `packages/server/src/__tests__/routes/preview.test.ts` — extend with suggestion cases + dismissal-filter case
- `packages/server/src/__tests__/routes/invite-gate.test.ts` — extend with the new route's gating
- `packages/web/src/api/types.ts` — mirror `Suggestion`, `SuggestionType`, extend `PreviewOutput`
- `packages/web/src/api/client.ts` — `postDismissSuggestion`
- `packages/web/src/__tests__/api/client.test.ts` — extend with dismiss test
- `packages/web/src/App.vue` — render `SuggestionsPanel`, watch-reset suggestions store on preview change

## Out of scope (deferred)

- **Set-area-id one-click write to HA** (vs deep-link). Requires `HaClient.setEntityAreaId` + a new POST endpoint. P3 polish if users ask.
- **Toast-on-error for failed Dismiss.** Lite version leaves the suggestion visible; user retries.
- **Garbage collection for stale dismissals** (entities removed from HA). SQLite handles unbounded growth fine; cleanup is a future polish.
- **More suggestion types** (e.g., "consider a per-domain card pack", "set device area_id", "rename for clarity"). Each is its own ticket.
- **Suggestion priority / ranking.** Current sort is by entityId then type. A future ticket could rank by confidence delta or impact.
- **"Accept all of type X" bulk action.** Out of scope; matches the lite framing.
