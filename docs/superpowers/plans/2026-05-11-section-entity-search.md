# Section Entity Search Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add live per-section entity search to the review screen so large Home Assistant installs are easier to inspect.

**Architecture:** Filtering stays entirely in the Vue web package. A tiny helper normalizes queries and matches `entityId` plus friendly-name text, while each section component owns its own search input and filtered row list.

**Tech Stack:** Vue 3 `<script setup>`, Pinia test store, vue-i18n, Vitest, Vue Test Utils, TypeScript.

---

### Task 1: Add Search Tests

**Files:**

- Modify: `packages/web/src/__tests__/components/RoomList.test.ts`
- Modify: `packages/web/src/__tests__/components/MiscBucket.test.ts`
- Modify: `packages/web/src/__tests__/components/AdministrativeEntitiesPanel.test.ts`
- Modify: `packages/web/src/__tests__/components/HiddenEntitiesPanel.test.ts`

- [ ] **Step 1: Write failing tests**

Add tests that exercise user-visible filtering through inputs:

```ts
it('filters rooms by matching entity id', async () => {
  const rooms = [
    room({
      id: 'kitchen',
      displayName: 'Kitchen',
      assignments: [
        { entityId: 'light.kitchen_ceiling', roomId: 'kitchen', confidence: 0.9, signals: [] },
      ],
    }),
    room({
      id: 'bedroom',
      displayName: 'Bedroom',
      assignments: [
        { entityId: 'sensor.bedroom_temp', roomId: 'bedroom', confidence: 0.8, signals: [] },
      ],
    }),
  ]
  const wrapper = mount(RoomList, {
    props: { rooms },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })
  await wrapper.find('[data-testid="section-search"]').setValue('bedroom_temp')
  expect(wrapper.findAll('[data-testid="room-row"]')).toHaveLength(1)
  expect(wrapper.text()).toContain('sensor.bedroom_temp')
  expect(wrapper.text()).not.toContain('light.kitchen_ceiling')
})
```

```ts
it('bulk select only selects filtered misc rows', async () => {
  const wrapper = mountBucket([
    { entityId: 'sensor.alpha', friendlyName: 'Alpha Sensor', domain: 'sensor' },
    { entityId: 'sensor.beta', friendlyName: 'Beta Sensor', domain: 'sensor' },
    { entityId: 'sensor.gamma', friendlyName: 'Gamma Sensor', domain: 'sensor' },
  ])
  await wrapper.find('[data-testid="section-search"]').setValue('beta')
  await wrapper.findAll('[data-testid="misc-row-checkbox"]')[0]!.setValue(true)
  await wrapper.find('[data-testid="misc-bulk-toggle-all"]').trigger('click')
  expect(wrapper.find('[data-testid="misc-bulk-bar"]').text()).toContain('1 selected')
})
```

- [ ] **Step 2: Run tests to verify they fail**

Run:

```bash
pnpm --filter @lovelacer/web test -- packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/components/MiscBucket.test.ts packages/web/src/__tests__/components/AdministrativeEntitiesPanel.test.ts packages/web/src/__tests__/components/HiddenEntitiesPanel.test.ts
```

Expected: FAIL because `[data-testid="section-search"]` does not exist yet.

### Task 2: Add Shared Filter Helper

**Files:**

- Create: `packages/web/src/entity-search.ts`

- [ ] **Step 1: Write helper**

```ts
export function normalizeEntitySearch(value: string): string {
  return value.trim().toLocaleLowerCase()
}

export function entityMatchesSearch(
  query: string,
  entityId: string,
  friendlyName: string,
): boolean {
  const normalized = normalizeEntitySearch(query)
  if (normalized === '') return true
  return (
    entityId.toLocaleLowerCase().includes(normalized) ||
    friendlyName.toLocaleLowerCase().includes(normalized)
  )
}
```

- [ ] **Step 2: Use the helper from component implementations**

Import `entityMatchesSearch` into each modified component. Do not introduce server API changes.

### Task 3: Implement Room Filtering

**Files:**

- Modify: `packages/web/src/components/RoomList.vue`
- Modify: `packages/web/src/locales/en.json`
- Modify: `packages/web/src/locales/cs.json`
- Modify: `packages/web/src/locales/de.json`

- [ ] **Step 1: Add local state and computed filtered rooms**

```ts
const searchQuery = ref('')
const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const filteredRooms = computed(() =>
  props.rooms
    .map((room) => {
      const assignments = room.assignments.filter((a) =>
        entityMatchesSearch(searchQuery.value, a.entityId, entityIdToFriendly(a.entityId)),
      )
      return {
        ...room,
        assignments,
        entityCount: hasSearch.value ? assignments.length : room.entityCount,
      }
    })
    .filter((room) => !hasSearch.value || room.assignments.length > 0),
)
```

- [ ] **Step 2: Render search input and filtered rows**

Use one input above the room list:

```vue
<input
  v-model="searchQuery"
  type="search"
  data-testid="section-search"
  :aria-label="t('sectionSearch.roomsLabel')"
  :placeholder="t('sectionSearch.roomsPlaceholder')"
/>
```

Render `filteredRooms` in the existing `v-for`, and use an empty state when `hasSearch && filteredRooms.length === 0`.

### Task 4: Implement Misc Filtering

**Files:**

- Modify: `packages/web/src/components/MiscBucket.vue`

- [ ] **Step 1: Filter before read-only truncation**

```ts
const searchQuery = ref('')
const hasSearch = computed(() => normalizeEntitySearch(searchQuery.value) !== '')
const filteredMisc = computed(() =>
  props.misc.filter((entity) =>
    entityMatchesSearch(searchQuery.value, entity.entityId, entity.friendlyName),
  ),
)
const displayedMisc = computed(() =>
  props.readOnly === true ? filteredMisc.value.slice(0, READONLY_ROW_LIMIT) : filteredMisc.value,
)
```

- [ ] **Step 2: Make bulk selection operate on filtered rows**

```ts
const allSelected = computed(
  () =>
    filteredMisc.value.length > 0 &&
    filteredMisc.value.every((m) => selected.value.has(m.entityId)),
)

function toggleAll(): void {
  if (allSelected.value) {
    selected.value = new Set()
    return
  }
  selected.value = new Set(filteredMisc.value.map((m) => m.entityId))
}
```

### Task 5: Implement Administrative and Hidden Filtering

**Files:**

- Modify: `packages/web/src/components/AdministrativeEntitiesPanel.vue`
- Modify: `packages/web/src/components/HiddenEntitiesPanel.vue`

- [ ] **Step 1: Add search state and filtered computed values**

Administrative:

```ts
const searchQuery = ref('')
const filteredAdministrative = computed(() =>
  props.administrative.filter((entity) =>
    entityMatchesSearch(searchQuery.value, entity.entityId, entity.friendlyName),
  ),
)
```

Hidden:

```ts
const searchQuery = ref('')
const filteredHidden = computed(() =>
  hidden.value.filter((entry) =>
    entityMatchesSearch(searchQuery.value, entry.entityId, entry.friendlyName),
  ),
)
```

- [ ] **Step 2: Render filtered rows**

Use `filteredAdministrative` and `filteredHidden` for the row loops. Add the same section search input pattern and empty state.

### Task 6: Verify and Commit

**Files:**

- All files touched above

- [ ] **Step 1: Run focused component tests**

```bash
pnpm --filter @lovelacer/web test -- packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/components/MiscBucket.test.ts packages/web/src/__tests__/components/AdministrativeEntitiesPanel.test.ts packages/web/src/__tests__/components/HiddenEntitiesPanel.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run web package verification**

```bash
pnpm --filter @lovelacer/web test
pnpm --filter @lovelacer/web typecheck
```

Expected: PASS.

- [ ] **Step 3: Commit**

```bash
git add docs/superpowers/plans/2026-05-11-section-entity-search.md packages/web/src
git commit -m "feat(web): add entity search filters"
```
