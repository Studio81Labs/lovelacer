# P2-4 — Misc Bucket UX — Design

**Status:** Draft v1 · **Date:** 2026-05-02 · **Phase:** 2 (Polish & Release) · **Sizing:** M

## Goal

Add bulk selection + bulk-assign / bulk-hide actions to the existing misc-bucket panel so users can clear an unassigned bucket of 30+ entities with a few clicks instead of 60. The current per-entity dropdown stays — bulk is purely additive.

**Acceptance criteria** (from ROADMAP.md):

- Bulk assign works.
- Misc shrinks after assignment.
- New analysis preserves assignments.

## Context

Phase 2 ticket 4. Phase 2 has shipped P2-1 (re-analysis diff view), P2-2 (YAML export), and P2-3 (floor-aware grouping). Sizing: M (~2-3 evenings).

P1b-3 / P1b-4 built the override foundation: SQLite `OverrideStore` server-side, `GET/PUT /api/overrides`, the Pinia `useOverridesStore` with `setRoomId(entityId, roomId)`, `setHidden(entityId, bool)`, dirty-state tracking, and `saveAndReanalyze()`. The current `MiscBucket.vue` already renders each misc entity with the full `EntityRow` (per-entity dropdown + hide toggle), so users can assign one at a time today. The friction is volume — a 30-entity misc bucket needs 60 individual clicks.

P2-4 is purely a frontend UX upgrade. No server changes, no API changes, no new state. The bulk action just calls the existing per-entity store methods N times, accumulating into the same dirty-state pattern P1b-4 established.

## Architecture & data flow

Two pieces, all frontend (no server changes):

1. **`MiscBucket.vue` enhanced in place.** Adds:
   - Component-scoped reactive `ref<Set<string>>` of selected entity IDs. No store needed — selection is ephemeral, doesn't persist across reloads.
   - A checkbox column rendered in front of each existing `EntityRow`. The checkbox sits as a sibling in the list-item layout (NOT inside `EntityRow` — keeps that component focused on per-entity edit).
   - A sticky bulk-action bar that mounts when `selected.size > 0`: shows "N selected", a "Select all" / "Select none" toggle, a room dropdown (same `ASSIGNABLE_ROOMS` list used in `EntityRow`), an "Assign" button, a "Hide" button, a "Clear" link.
   - "Assign" iterates the selected set and calls `overrides.setRoomId(id, roomId)` for each. "Hide" calls `overrides.setHidden(id, true)`. After applying, selection clears and the existing `OverridesBar` reflects the new dirty count.

2. **No store changes, no API changes.** `overrides.setRoomId` and `overrides.setHidden` already accept single-entity edits and accumulate into the dirty-state pattern. The bulk action calls each method N times. The existing `Save` button on `OverridesBar` PUTs the merged batch to `/api/overrides` exactly as today.

The selection state lives inside `MiscBucket.vue` because it's view-local — the user's "I'm currently selecting these 5 to bulk-edit" intent doesn't need to survive component remount or share with other components. If a future ticket adds bulk select to room views, each component would have its own selection state independently.

## `MiscBucket.vue` template

The script setup grows from ~5 lines to ~45. The template grows from ~15 lines to ~75. Three new pieces inside the existing `<details>`:

```vue
<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import EntityRow from './EntityRow.vue'
import { useOverridesStore } from '../stores/overrides.js'
import { ASSIGNABLE_ROOMS, roomIdToDisplay } from '../rooms.js'
import type { MiscEntity } from '../api/types.js'

const props = defineProps<{ misc: MiscEntity[] }>()
const overrides = useOverridesStore()

const selected = ref<Set<string>>(new Set())
const bulkRoom = ref<string>('') // '' = no room picked yet (Assign disabled)

const selectedCount = computed(() => selected.value.size)
const allSelected = computed(
  () => props.misc.length > 0 && selected.value.size === props.misc.length,
)
const isSaving = computed(() => overrides.phase === 'saving')

function toggleOne(entityId: string, checked: boolean): void {
  const next = new Set(selected.value)
  if (checked) next.add(entityId)
  else next.delete(entityId)
  selected.value = next
}

function toggleAll(): void {
  selected.value = allSelected.value ? new Set() : new Set(props.misc.map((m) => m.entityId))
}

function applyAssign(): void {
  const target = bulkRoom.value === '' ? null : bulkRoom.value
  for (const id of selected.value) overrides.setRoomId(id, target)
  selected.value = new Set()
  bulkRoom.value = ''
}

function applyHide(): void {
  for (const id of selected.value) overrides.setHidden(id, true)
  selected.value = new Set()
}

function clearSelection(): void {
  selected.value = new Set()
}

// Selection survives across component lifetime but should reset whenever
// the visible misc list changes identity (e.g., after a re-analyze that
// drained or refreshed the bucket). Otherwise selectedCount could refer
// to entityIds no longer in props.misc.
watch(
  () => props.misc,
  () => {
    selected.value = new Set()
  },
)
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white">
    <summary class="cursor-pointer px-5 py-3 text-sm font-medium text-stone-700 hover:bg-stone-50">
      {{ misc.length }} entities not assigned to any room
    </summary>

    <div
      v-if="selectedCount > 0"
      data-testid="misc-bulk-bar"
      class="sticky top-0 z-10 flex items-center gap-3 border-b border-amber-200 bg-amber-50 px-5 py-2 text-xs"
    >
      <span class="font-medium text-amber-900">{{ selectedCount }} selected</span>
      <button type="button" class="text-amber-700 hover:underline" @click="toggleAll">
        {{ allSelected ? 'Select none' : 'Select all' }}
      </button>

      <select
        v-model="bulkRoom"
        data-testid="misc-bulk-room"
        :disabled="isSaving"
        class="rounded border border-stone-300 bg-white px-2 py-1 text-xs"
      >
        <option value="">— pick room —</option>
        <option v-for="rid in ASSIGNABLE_ROOMS" :key="rid" :value="rid">
          {{ roomIdToDisplay(rid) }}
        </option>
      </select>
      <button
        type="button"
        data-testid="misc-bulk-assign"
        class="rounded bg-brand-600 px-3 py-1 font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="bulkRoom === '' || isSaving"
        @click="applyAssign"
      >
        Assign
      </button>
      <button
        type="button"
        data-testid="misc-bulk-hide"
        class="rounded border border-stone-300 bg-white px-3 py-1 font-medium text-stone-700 hover:bg-stone-50 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSaving"
        @click="applyHide"
      >
        Hide
      </button>
      <button
        type="button"
        class="ml-auto text-stone-600 hover:text-stone-900"
        @click="clearSelection"
      >
        Clear
      </button>
    </div>

    <ul class="divide-y divide-stone-100 border-t border-stone-100 bg-stone-50/30">
      <li v-for="entity in misc" :key="entity.entityId" class="flex items-center gap-3 pl-5">
        <input
          type="checkbox"
          :checked="selected.has(entity.entityId)"
          :disabled="isSaving"
          data-testid="misc-row-checkbox"
          :aria-label="`Select ${entity.entityId}`"
          class="h-4 w-4 rounded border-stone-300"
          @change="toggleOne(entity.entityId, ($event.target as HTMLInputElement).checked)"
        />
        <div class="flex-1">
          <EntityRow
            :entity-id="entity.entityId"
            :friendly-name="entity.friendlyName"
            room-id="misc"
          />
        </div>
      </li>
    </ul>
  </details>
</template>
```

Notes:

- The bulk bar uses the **amber** palette to match `OverridesBar`'s "you have unsaved changes" treatment — one mental category for "pending action".
- `sticky top-0` keeps the bulk bar visible while the user scrolls a long misc list. `z-10` stays under any future modal.
- The "Assign" button is disabled until the user picks a real room. The `bulkRoom === ''` sentinel means "no room picked"; if it ever needs to mean "let detector decide" (the `setRoomId(id, null)` reset semantics), that's a future "bulk reset" affordance — deferred.
- "Hide" is always enabled when there's a selection.
- Each `<li>` flexes the checkbox alongside the existing `EntityRow`, which keeps the per-entity edit controls fully functional. `EntityRow` is unchanged.
- The `watch(() => props.misc, ...)` clears selection on every re-analyze. Selection always reflects the current visible misc list. If the user has a pending bulk-edit AND clicks "Discard" on the OverridesBar (no re-analyze), selection clears too — fine because they're abandoning the edit.

## Edge cases & error handling

- **Selection survives re-analysis?** No. The `watch` on `props.misc` clears selection whenever the prop's identity changes. After Save → saveAndReanalyze → fresh `analyze.preview.misc`, selection resets to empty automatically. Stale entityIds never appear in `selectedCount`.
- **User checks boxes, then bulk-assigns to room A, then immediately bulk-hides another batch.** Both actions accumulate into `dirtyState` via the existing `setRoomId` / `setHidden` calls. `OverridesBar.dirtyCount` reflects the cumulative count. Save persists everything. Discard clears everything (including the new bulk edits) — exactly mirroring per-entity behavior.
- **A pending dirty edit exists for an entity, then bulk-assign overwrites it.** `setRoomId` collapses to "back to server value" if the new value matches the server. It correctly handles overwriting a dirty value with another dirty value. No special bulk handling needed.
- **Selection contains an entity that's already hidden.** `setHidden(id, true)` on an already-hidden entity is a no-op (the new override equals the existing one, `setDirtyOrCollapse` removes it from dirty state).
- **`isSaving` mid-action.** All bulk buttons disable while `overrides.phase === 'saving'`. The checkbox toggles also disable. Per-entity `EntityRow` controls already disable on saving. No race window.
- **Empty misc list.** `<details v-if="misc.length > 0">` already guards. If `props.misc` becomes `[]` after a re-analyze that drained the bucket, the panel disappears entirely.
- **Single-row misc list.** Bulk UI works with N=1 too. User checks the one row, picks a room, clicks Assign. Equivalent to using the per-entity dropdown but consistent with the multi-select flow.
- **Accessibility.** Each checkbox has `aria-label="Select <entityId>"`. The bulk bar's role is implicit via its sticky position + visible buttons — no `aria-live` needed since changes are user-driven.
- **Snapshot / diff impact (P2-1).** None. The diff operates on entity→room assignments. Bulk-assigning misc entities to rooms produces the same `EntityDiff[]` (kind: 'moved', previousRoomId: null, currentRoomId: 'kitchen') that one-at-a-time assignment produces. Re-analyze after save → next preview → diff banner shows the bulk move.
- **Floor section (P2-3).** None. Floor data flows from `area_id`, not from override-assigned `roomId`. A misc entity assigned to "Kitchen" via override gets a roomId but no haAreaId. `assignFloors` keys by haAreaId, so override-assigned entities don't pick up a floor. The floor section already correctly excludes misc-rooted assignments.
- **Bulk-assign target room with the "let detector decide" sentinel.** Disabled at the UI level (Assign button disabled until `bulkRoom !== ''`). If a future ticket wants "bulk reset" semantics, that's its own affordance — deferred.

## Testing strategy

**`packages/web/src/__tests__/components/MiscBucket.test.ts`** — extends the existing test file with a new `describe('bulk select')` block:

- **Selection mechanics:**
  - Initial render: bulk bar absent (`selectedCount === 0`).
  - Check one box → bulk bar appears, shows "1 selected".
  - Check two boxes → "2 selected".
  - Uncheck a box → count drops; bar disappears at 0.
  - Click "Select all" → all checkboxes checked, bar shows "N selected".
  - Click "Select none" (when all selected) → bar disappears.
  - Click "Clear" → selection clears.
- **Bulk assign:**
  - With 2 selected and `bulkRoom === ''` → "Assign" disabled.
  - With 2 selected and `bulkRoom = 'kitchen'` → click Assign → `overrides.setRoomId` called twice with `'kitchen'`. Selection clears. `bulkRoom` resets to `''`.
  - Verify call shape via spy on `useOverridesStore`'s `setRoomId`.
- **Bulk hide:**
  - With 3 selected → click "Hide" → `overrides.setHidden(id, true)` called 3 times. Selection clears.
- **Selection clears when `props.misc` changes** (regression test for stale selection after re-analyze):
  - Mount with 5 misc entities, select 2.
  - Update props to a new array with 3 different entities.
  - Assert selection has cleared.
- **Disable during save:**
  - Set `overrides.phase = 'saving'` via testing-pinia.
  - Verify checkboxes disabled, Assign/Hide/Select-all/Clear all disabled (or non-interactive).
  - Verify `bulkRoom` select disabled.
- **Existing per-entity row still works:**
  - Mount with 1 misc entity, don't touch the checkbox.
  - Use the `EntityRow` per-row dropdown to assign to "kitchen".
  - Verify `overrides.setRoomId` was called with the right args. (Validates the bulk UI didn't regress per-entity behavior.)

**`packages/web/src/__tests__/App.test.ts`** — extends the existing integration test:

- New case: user has 3 misc entities, checks all 3, picks "Kitchen", clicks Assign, clicks Save (on `OverridesBar`).
  - Verifies `putOverrides` was called with the merged batch (3 new entries with `roomId: 'kitchen'`).
  - Verifies the analyze store fires a re-analyze after save.
  - Mock the re-analyze response so misc shrinks → confirm `<details>` reflects the new shorter count or disappears.

**No server-side test changes.** The override route's `PUT /api/overrides` already accepts arbitrary-length arrays — bulk requests just have more entries. Existing route tests cover validation, persistence, idempotence. No new behaviors at the API layer.

**Manual smoke test (per ROADMAP DoD):** spin dev HA, analyze, expand the misc bucket, check 5 entities, pick a room, Assign, click Save. Verify the 5 entities appear in their target room view and the misc count drops by 5. Re-analyze (no edits) and verify they stay assigned (override persists across analyze cycles — covered by P1b-3's existing override persistence; bulk-assign just batched the same calls).

## File summary

**Modified:**

- `packages/web/src/components/MiscBucket.vue` — script setup grows from ~5 to ~45 lines; template grows from ~15 to ~75 lines. Adds selection state, bulk action bar, per-row checkboxes. `EntityRow` unchanged.
- `packages/web/src/__tests__/components/MiscBucket.test.ts` — extends with the bulk-select describe block.
- `packages/web/src/__tests__/App.test.ts` — extends with the bulk-then-save integration case.

No new files. No server changes. No API changes. No new types.

## Out of scope (deferred)

- **Bulk reset / clear-override.** A "Reset selected" button that sends entries back to the detector via `setRoomId(id, null)`. Useful for undoing a batch assignment, but Q1's option C — deferred. Easy to add later if users ask.
- **Filtering / search inside the misc list.** Useful for 100+ entity buckets. The current `<details>` + `<ul>` lays them flat. P3 polish.
- **Group-by-domain inside the bucket.** "5 sensor._ entities, 12 binary_sensor._ entities" subgroup headers. Helps users batch-hide diagnostic sensors faster. P3 or later.
- **Bulk select on room views.** Same checkbox + bulk-assign UX, but for moving entities BETWEEN rooms (e.g., select 3 entities in Living Room, bulk-move to Kitchen). Not in the AC; defer until users ask.
- **Keyboard shortcuts** (e.g., shift-click range selection, ctrl/cmd-A for select all). Mouse-only is fine for v1.
- **Server-side bulk endpoint.** The current `PUT /api/overrides` already handles arbitrary-length payloads, so no new endpoint needed. A future "bulk apply" endpoint could be more efficient at scale (1000+ entities), but YAGNI for closed beta.
