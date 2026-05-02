# P2-4 Misc Bucket UX Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add bulk selection + bulk-assign + bulk-hide actions to the misc-bucket panel so users can clear an unassigned bucket of 30+ entities with a few clicks instead of 60.

**Architecture:** Frontend-only enhancement to `packages/web/src/components/MiscBucket.vue`. Adds component-scoped `ref<Set<string>>` selection state, a sticky amber action bar mounted when `selected.size > 0`, and a per-row checkbox sibling next to the existing `EntityRow`. Bulk actions iterate the selected set and call the existing per-entity store methods (`overrides.setRoomId`, `overrides.setHidden`) — no API changes, no store changes, no new types. Selection clears via `watch(props.misc)` whenever the visible misc list changes identity (e.g., after a re-analyze).

**Tech Stack:** Vue 3 + Pinia 2 + Tailwind 4, Vitest with `globals: false`, `@vue/test-utils` for component tests, `@pinia/testing@^0.1.7` (Pinia 2.x compat) with `createTestingPinia({ stubActions: false, createSpy: vi.fn })`.

---

## Source of Truth

`docs/superpowers/specs/2026-05-02-p2-4-misc-bucket-ux-design.md` is the canonical spec. If anything in this plan contradicts that doc, the spec wins — fix the plan and re-run.

## Codebase Conventions (read before starting)

- The web package has zero workspace dependencies. `MiscEntity` is mirrored locally in `packages/web/src/api/types.ts` as `{ entityId, friendlyName, domain }`.
- `ASSIGNABLE_ROOMS` (string array) and `roomIdToDisplay(string): string` live in `packages/web/src/rooms.ts`. The same imports are used by the existing `EntityRow.vue`.
- The `useOverridesStore` from `packages/web/src/stores/overrides.ts` exposes `setRoomId(entityId, roomId | null)`, `setHidden(entityId, boolean)`, `phase`, `dirtyCount`, `effective(entityId)`. Calling `setRoomId(id, null)` clears the room override (sends entity back to detector).
- `MiscBucket.vue` currently renders a collapsible `<details>` with one `EntityRow` per misc entity, `room-id="misc"`. This stays — bulk UI is additive.
- Existing `MiscBucket.test.ts` has 3 tests using `mountBucket(misc)` helper that wraps `createTestingPinia({ stubActions: false, createSpy: vi.fn })`. With `stubActions: false`, calling `overrides.setRoomId(...)` runs the real action — assertions can either spy on the action or observe `dirtyCount` / `effective(id)` after the call. **Prefer the behavioral observation** — it's more honest about what the user sees.
- The `OverridesBar` component (`packages/web/src/components/OverridesBar.vue`) shows the dirty count + Save/Discard buttons. It already integrates with the per-entity `EntityRow` flow. No changes needed there — the bulk actions accumulate into the same `dirtyState`.

## File Structure

**Modified:**

| Path                                                       | Changes                                                                                      |
| ---------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| `packages/web/src/components/MiscBucket.vue`               | Script setup grows ~5 → ~45 lines; template grows ~15 → ~75 lines. Selection + bulk actions. |
| `packages/web/src/__tests__/components/MiscBucket.test.ts` | Extends with bulk-select describe block (~12 new tests).                                     |
| `packages/web/src/__tests__/App.test.ts`                   | Adds one integration test for bulk-then-save-then-reanalyze flow.                            |

**No new files. No server changes. No API changes. No new types.**

---

## Setup

- [ ] **Step 0a: Create the worktree**

```bash
git fetch origin
git worktree add .worktrees/p2-4-misc-bucket-ux -b feat/p2-4-misc-bucket-ux origin/main
cd .worktrees/p2-4-misc-bucket-ux
```

Expected: new worktree on branch `feat/p2-4-misc-bucket-ux` based on the latest `origin/main`. Spec file is present.

- [ ] **Step 0b: Verify baseline is green**

```bash
pnpm install
pnpm test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Baseline web suite has 123 tests; full workspace is 693.

---

## Task 1: MiscBucket.vue — Selection + Bulk Actions

**Files:**

- Modify: `packages/web/src/components/MiscBucket.vue`
- Modify: `packages/web/src/__tests__/components/MiscBucket.test.ts`

**Why this task:** Self-contained component change with comprehensive unit-test coverage. Implements the full feature: selection state, sticky action bar, bulk-assign, bulk-hide, select-all/none, clear, watch-prop-reset. The integration test in Task 2 validates the end-to-end save+re-analyze flow.

### Step 1: Write the failing tests

Edit `packages/web/src/__tests__/components/MiscBucket.test.ts`. Append a new `describe` block after the existing `describe('MiscBucket')`. Update the existing `mountBucket` helper to accept an optional second arg for setting the override-store phase (used by the disable-during-save test). The full file becomes:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import MiscBucket from '../../components/MiscBucket.vue'
import type { MiscEntity } from '../../api/types.js'
import { useOverridesStore } from '../../stores/overrides.js'

function mountBucket(misc: MiscEntity[]) {
  return mount(MiscBucket, {
    props: { misc },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('MiscBucket', () => {
  it('does not render when misc is empty', () => {
    const wrapper = mountBucket([])
    expect(wrapper.find('details').exists()).toBe(false)
  })

  it('renders summary count when misc is non-empty', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'B', domain: 'sensor' },
    ])
    expect(wrapper.find('summary').text()).toContain('2')
  })

  it('renders one EntityRow per misc entity', () => {
    const wrapper = mountBucket([
      { entityId: 'a.b', friendlyName: 'Entity A', domain: 'sensor' },
      { entityId: 'c.d', friendlyName: 'Entity B', domain: 'sensor' },
    ])
    const rows = wrapper.findAll('[data-testid="entity-row"]')
    expect(rows).toHaveLength(2)
    expect(rows[0]!.text()).toContain('a.b')
    expect(rows[0]!.text()).toContain('Entity A')
    expect(rows[1]!.text()).toContain('c.d')
    expect(rows[1]!.text()).toContain('Entity B')
  })
})

describe('MiscBucket bulk select', () => {
  const sample: MiscEntity[] = [
    { entityId: 'sensor.a', friendlyName: 'Sensor A', domain: 'sensor' },
    { entityId: 'sensor.b', friendlyName: 'Sensor B', domain: 'sensor' },
    { entityId: 'sensor.c', friendlyName: 'Sensor C', domain: 'sensor' },
  ]

  it('does not render the bulk bar when no entities are selected', () => {
    const wrapper = mountBucket(sample)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('shows the bulk bar with "1 selected" when one checkbox is checked', async () => {
    const wrapper = mountBucket(sample)
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!
    await checkbox.setValue(true)
    const bar = wrapper.find('[data-testid="misc-bulk-bar"]')
    expect(bar.exists()).toBe(true)
    expect(bar.text()).toContain('1 selected')
  })

  it('updates the count as more checkboxes are checked', async () => {
    const wrapper = mountBucket(sample)
    const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
    await checkboxes[0]!.setValue(true)
    await checkboxes[1]!.setValue(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('2 selected')
  })

  it('hides the bulk bar when the count returns to zero', async () => {
    const wrapper = mountBucket(sample)
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!
    await checkbox.setValue(true)
    await checkbox.setValue(false)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('selects all rows when "Select all" is clicked', async () => {
    const wrapper = mountBucket(sample)
    // Need at least one selected first to make the bulk bar visible.
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    const selectAllBtn = wrapper.findAll('button').find((b) => b.text() === 'Select all')!
    await selectAllBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('3 selected')
    const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
    for (const cb of checkboxes) {
      expect((cb.element as HTMLInputElement).checked).toBe(true)
    }
  })

  it('clears selection when "Select none" is clicked (after Select all)', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper
      .findAll('button')
      .find((b) => b.text() === 'Select all')!
      .trigger('click')
    // Now all are selected; the toggle button should read "Select none".
    const noneBtn = wrapper.findAll('button').find((b) => b.text() === 'Select none')!
    await noneBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('clears selection when "Clear" is clicked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    const clearBtn = wrapper.findAll('button').find((b) => b.text() === 'Clear')!
    await clearBtn.trigger('click')
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('disables Assign until a target room is picked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    expect(assignBtn.attributes('disabled')).toBeDefined()
  })

  it('enables Assign once a target room is picked', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    expect(assignBtn.attributes('disabled')).toBeUndefined()
  })

  it('bulk-assigns selected entities and stages them in the override store', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
    await wrapper.find('[data-testid="misc-bulk-assign"]').trigger('click')

    // Two entities now have a pending kitchen override.
    expect(overrides.dirtyCount).toBe(2)
    expect(overrides.effective('sensor.a')?.roomId).toBe('kitchen')
    expect(overrides.effective('sensor.b')?.roomId).toBe('kitchen')
    // Selection cleared after applying.
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('bulk-hides selected entities and stages them in the override store', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[2]!.setValue(true)
    await wrapper.find('[data-testid="misc-bulk-hide"]').trigger('click')

    expect(overrides.dirtyCount).toBe(3)
    expect(overrides.effective('sensor.a')?.hidden).toBe(true)
    expect(overrides.effective('sensor.b')?.hidden).toBe(true)
    expect(overrides.effective('sensor.c')?.hidden).toBe(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('clears selection when props.misc changes (regression: stale selection after re-analyze)', async () => {
    const wrapper = mountBucket(sample)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[1]!.setValue(true)
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('2 selected')
    // Simulate a re-analyze handing in a fresh, shorter misc list.
    await wrapper.setProps({
      misc: [{ entityId: 'sensor.different', friendlyName: 'Diff', domain: 'sensor' }],
    })
    expect(wrapper.find('[data-testid="misc-bulk-bar"]').exists()).toBe(false)
  })

  it('disables bulk controls while overrides.phase is "saving"', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    // Select to surface the bulk bar.
    await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
    // Move into saving phase via a direct ref assignment (testing-pinia).
    overrides.$patch({ phase: 'saving' })
    await wrapper.vm.$nextTick()

    const assignBtn = wrapper.find('[data-testid="misc-bulk-assign"]')
    const hideBtn = wrapper.find('[data-testid="misc-bulk-hide"]')
    const roomSelect = wrapper.find('[data-testid="misc-bulk-room"]')
    const checkbox = wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!

    expect(assignBtn.attributes('disabled')).toBeDefined()
    expect(hideBtn.attributes('disabled')).toBeDefined()
    expect(roomSelect.attributes('disabled')).toBeDefined()
    expect((checkbox.element as HTMLInputElement).disabled).toBe(true)
  })

  it('preserves per-entity EntityRow controls (regression: bulk UI did not break the existing dropdown)', async () => {
    const wrapper = mountBucket(sample)
    const overrides = useOverridesStore()
    // Don't touch the bulk checkboxes. Use the per-row dropdown directly.
    const rowSelect = wrapper.findAll('[data-testid="room-select"]')[0]!
    await rowSelect.setValue('living_room')
    expect(overrides.effective('sensor.a')?.roomId).toBe('living_room')
  })
})
```

### Step 2: Run tests to verify they fail

```bash
pnpm --filter @lovelacer/web test -- MiscBucket
```

Expected: FAIL — most new tests fail because `[data-testid="misc-bulk-bar"]` and the bulk controls don't exist yet. Existing 3 tests pass.

### Step 3: Update `MiscBucket.vue` template + script

Rewrite `packages/web/src/components/MiscBucket.vue` entirely:

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

// Selection should reset whenever the visible misc list changes identity
// (e.g., after a re-analyze). Otherwise selectedCount could refer to
// entityIds no longer in props.misc — stale state and a misleading UI.
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

### Step 4: Run tests to verify they pass

```bash
pnpm --filter @lovelacer/web test -- MiscBucket
```

Expected: 16/16 pass (3 existing + 13 new). If any fail, read the failure carefully — common pitfalls:

- `setValue(true)` on a checkbox may not trigger `@change`. If a test fails because `dirtyCount` stays at 0 after a checkbox interaction, switch to `await checkbox.trigger('change')` or use `await checkbox.setChecked(true)` (if available in the installed `@vue/test-utils` version).
- `wrapper.findAll('button').find((b) => b.text() === 'Select all')` matches on inner text. The button content is `{{ allSelected ? 'Select none' : 'Select all' }}` — make sure no leading/trailing whitespace breaks the match. Use `.trim()` if needed: `b.text().trim() === 'Select all'`.
- `[data-testid="room-select"]` is the per-entity dropdown inside `EntityRow.vue`. The bulk-room dropdown has `data-testid="misc-bulk-room"`. Don't confuse them.

### Step 5: Run full web suite + typecheck + lint + format

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Web test count grows by 13 (123 → 136). Typecheck and lint clean.

### Step 6: Commit

```bash
git add packages/web/src/components/MiscBucket.vue \
  packages/web/src/__tests__/components/MiscBucket.test.ts
git commit -m "feat(web): bulk select + bulk assign/hide on MiscBucket"
```

---

## Task 2: App.test.ts Integration Test

**Files:**

- Modify: `packages/web/src/__tests__/App.test.ts`

**Why this task:** Validates the full bulk-then-save-then-reanalyze flow at the App level. This catches regressions where the per-entity dirty-state pattern silently breaks under bulk volume — e.g., a future override-store refactor that batches saves but loses individual entries.

### Step 1: Add the integration test

Edit `packages/web/src/__tests__/App.test.ts`. Append a new `it` block inside the existing `describe('App integration', ...)` block (alongside the analyze, edit, save flow tests):

```ts
it('bulk-assigns 3 misc entities and saves through OverridesBar', async () => {
  // Initial preview: 3 misc entities.
  const initialPreview: PreviewOutput = {
    rooms: [],
    misc: [
      { entityId: 'sensor.a', friendlyName: 'A', domain: 'sensor' },
      { entityId: 'sensor.b', friendlyName: 'B', domain: 'sensor' },
      { entityId: 'sensor.c', friendlyName: 'C', domain: 'sensor' },
    ],
    summary: { entityCount: 3, roomCount: 0, miscCount: 3 },
    config: { title: 'x', views: [] },
    diff: null,
  }

  // After bulk-assign + save, the misc list shrinks (server response stub).
  const reanalyzedPreview: PreviewOutput = {
    rooms: [
      {
        id: 'kitchen',
        haAreaId: 'kitchen',
        displayName: 'Kitchen',
        entityCount: 3,
        averageConfidence: 1,
        assignments: [
          { entityId: 'sensor.a', roomId: 'kitchen', confidence: 1, signals: [], manual: true },
          { entityId: 'sensor.b', roomId: 'kitchen', confidence: 1, signals: [], manual: true },
          { entityId: 'sensor.c', roomId: 'kitchen', confidence: 1, signals: [], manual: true },
        ],
      },
    ],
    misc: [],
    summary: { entityCount: 3, roomCount: 1, miscCount: 0 },
    config: { title: 'x', views: [] },
    diff: null,
  }

  ;(getOverrides as ReturnType<typeof vi.fn>).mockResolvedValue({ overrides: [] })
  ;(postPreview as ReturnType<typeof vi.fn>)
    .mockResolvedValueOnce(initialPreview)
    .mockResolvedValueOnce(reanalyzedPreview)
  ;(putOverrides as ReturnType<typeof vi.fn>).mockResolvedValue({
    overrides: [
      { entityId: 'sensor.a', roomId: 'kitchen' },
      { entityId: 'sensor.b', roomId: 'kitchen' },
      { entityId: 'sensor.c', roomId: 'kitchen' },
    ],
  })

  const wrapper = mount(App, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
  // Skip the invite gate so analyze can run.
  const invite = useInviteStore()
  invite.$patch({ accepted: true, phase: 'idle' })
  await wrapper.vm.$nextTick()

  // Trigger initial analyze.
  const analyze = useAnalyzeStore()
  await analyze.analyze()
  await wrapper.vm.$nextTick()

  // Expand the misc bucket.
  const miscDetails = wrapper.find('details')
  await miscDetails.trigger('click')
  await wrapper.vm.$nextTick()

  // Check all 3 misc rows.
  const checkboxes = wrapper.findAll('[data-testid="misc-row-checkbox"]')
  expect(checkboxes).toHaveLength(3)
  for (const cb of checkboxes) await cb.setValue(true)

  // Pick Kitchen and click Assign.
  await wrapper.find('[data-testid="misc-bulk-room"]').setValue('kitchen')
  await wrapper.find('[data-testid="misc-bulk-assign"]').trigger('click')
  await wrapper.vm.$nextTick()

  // OverridesBar should now show 3 dirty changes.
  const overrides = useOverridesStore()
  expect(overrides.dirtyCount).toBe(3)

  // Click Save on the OverridesBar.
  const saveBtn = wrapper.find('[data-testid="overrides-save"]')
  await saveBtn.trigger('click')
  await wrapper.vm.$nextTick()
  // Wait for the saveAndReanalyze promise chain to settle.
  await new Promise((resolve) => setTimeout(resolve, 0))
  await wrapper.vm.$nextTick()

  // putOverrides was called with the bulk batch.
  expect(putOverrides).toHaveBeenCalledTimes(1)
  const putArgs = (putOverrides as ReturnType<typeof vi.fn>).mock.calls[0]![0] as {
    overrides: { entityId: string; roomId?: string }[]
  }
  expect(putArgs.overrides).toHaveLength(3)
  expect(putArgs.overrides.every((o) => o.roomId === 'kitchen')).toBe(true)

  // Re-analyze fired (postPreview called twice now: initial + post-save).
  expect(postPreview).toHaveBeenCalledTimes(2)
})
```

If the existing imports at the top of `App.test.ts` don't already include `useOverridesStore`, add it:

```ts
import { useOverridesStore } from '../stores/overrides.js'
```

The other imports (`PreviewOutput`, `vi`, `mount`, `createTestingPinia`, `getOverrides`, `postPreview`, `putOverrides`, `useAnalyzeStore`, `useInviteStore`, `App`) should already be present from existing tests.

### Step 2: Run the App test suite

```bash
pnpm --filter @lovelacer/web test -- App
```

Expected: existing App tests still pass + 1 new test passes. If the new test fails:

- Check whether the existing helpers expect a specific mock-reset pattern. The `mockResolvedValueOnce` + `mockResolvedValue` chain assumes `postPreview` may have been mocked elsewhere; ensure no `mockReset` is called between the setup and the `analyze.analyze()` call.
- The `[data-testid="overrides-save"]` selector assumes `OverridesBar.vue` exposes that testid on its Save button. Verify by reading `packages/web/src/components/OverridesBar.vue` if the test fails finding the button.
- The `setTimeout(resolve, 0)` flush is a known pattern for letting micro-tasks settle in vitest. If the test still flakes, add a second `await wrapper.vm.$nextTick()`.

### Step 3: Run full web suite + typecheck + lint + format

```bash
pnpm --filter @lovelacer/web test
pnpm typecheck
pnpm lint
pnpm format:check
```

Expected: all pass. Web test count grows by 1 (136 → 137).

### Step 4: Run the full workspace test suite

```bash
pnpm test
```

Expected: all green.

### Step 5: Commit

```bash
git add packages/web/src/__tests__/App.test.ts
git commit -m "test(web): integration test for bulk-assign + save flow on misc bucket"
```

---

## Final Verification

- [ ] **Step F1: Full workspace test suite**

```bash
pnpm test
```

Expected: all packages green. Web grows by 14 (123 → 137); full workspace grows by 14 to ~707 total.

- [ ] **Step F2: Typecheck + lint + format-check**

```bash
pnpm typecheck && pnpm lint && pnpm format:check
```

Expected: all pass.

- [ ] **Step F3: Manual smoke test (per ROADMAP DoD)**

```bash
pnpm dev:ha   # bring up the dev HA container if not already running
pnpm dev      # start the server + web dev stack
```

In the browser:

1. Open the SPA. Accept invite if not already.
2. Click Analyze. Wait for the misc bucket to appear (assuming the dev fixture has unassigned entities).
3. Expand the "N entities not assigned to any room" details.
4. Check 5 entities. Verify the amber "5 selected" sticky bar appears at the top of the panel.
5. Pick "Kitchen" from the room dropdown. Verify the Assign button enables.
6. Click Assign. Verify:
   - The amber bar disappears (selection cleared).
   - The OverridesBar at the bottom of the page shows "5 pending changes".
7. Click Save on the OverridesBar. Wait for re-analyze.
8. Verify the misc bucket count drops by 5 (or the bucket disappears entirely if it was the last batch).
9. Navigate to the Kitchen room view in the dashboard preview — those 5 entities now appear there.

Negative test: Pick 3 entities that are clearly diagnostic (e.g., `sensor.*_signal_strength`), click Hide. Verify they show with `(hidden)` decoration in the misc list AND in the OverridesBar's pending-changes count.

- [ ] **Step F4: Push branch + open PR**

```bash
git push -u origin feat/p2-4-misc-bucket-ux
gh pr create --title "feat: P2-4 misc bucket UX" --body "$(cat <<'EOF'
## Summary

- Adds bulk select + bulk-assign + bulk-hide to `MiscBucket.vue`. Per-row checkbox + sticky amber action bar mounted when ≥1 entity is selected. The bar offers a room dropdown, Assign / Hide buttons, Select-all/none toggle, and Clear.
- Bulk actions iterate the selected set and call the existing `overrides.setRoomId` / `overrides.setHidden` per entity. No API changes, no store changes, no schema changes — accumulates into the same dirty-state pattern P1b-4 established.
- Selection auto-clears via `watch(props.misc)` after every re-analyze so stale entityIds never appear in the count.
- Per-entity `EntityRow` controls inside the bucket continue to work unchanged — bulk is purely additive.

Closes the AC from ROADMAP P2-4: "Bulk assign works; misc shrinks after assignment; new analysis preserves assignments."

## Test plan

- [x] `pnpm test` — full workspace suite green
- [x] `pnpm typecheck && pnpm lint && pnpm format:check` — all clean
- [ ] Manual smoke per the plan's Step F3 (analyze → expand misc → check 5 → Assign Kitchen → Save → verify misc shrinks + entities appear in Kitchen)

🤖 Generated with [Claude Code](https://claude.com/claude-code)
EOF
)"
```

---

## Out of Scope (per spec)

- Bulk reset / clear-override (deferred — easy follow-up if users ask).
- Filtering / search inside the misc list.
- Group-by-domain inside the bucket.
- Bulk select on room views (move entities BETWEEN rooms).
- Keyboard shortcuts (shift-click range, ctrl/cmd-A).
- Server-side bulk endpoint (the existing `PUT /api/overrides` already accepts arbitrary-length payloads).
