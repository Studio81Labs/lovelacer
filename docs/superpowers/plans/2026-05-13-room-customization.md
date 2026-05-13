# Room Customization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add user-editable room names, room icons, and generated-card name visibility that apply in Lovelacer's review UI and generated Home Assistant dashboard.

**Architecture:** Persist room customization in `Settings.roomOverrides`, keyed by analyzed room id. Server pipeline resolves effective room display metadata once per run and passes it to both analysis output and generator inputs. The web UI edits one room inline and saves through the existing settings store with an optimistic single-field save helper mirroring room order.

**Tech Stack:** TypeScript, Vue 3, Pinia, Fastify, Zod, SQLite via `better-sqlite3`, Vitest, Home Assistant Lovelace sections.

---

## File Structure

- Modify `packages/shared/src/types.ts`: add `RoomDisplayOverride` and optional `Settings.roomOverrides`.
- Modify `packages/server/src/storage/settings-store.ts`: validate persisted `roomOverrides`.
- Modify `packages/server/src/routes/settings.ts`: validate PUT `roomOverrides`.
- Modify `packages/web/src/api/types.ts`: mirror `RoomDisplayOverride` and `Settings.roomOverrides`.
- Modify `packages/generator/src/rooms.ts`: add effective room display resolver.
- Modify `packages/generator/src/room-view.ts`: accept display overrides for room views.
- Modify `packages/generator/src/home-view.ts`: accept display overrides for home room cards.
- Modify `packages/server/src/pipeline.ts`: resolve and apply room metadata to `AnalyzedRoom` and generator calls.
- Modify `packages/web/src/icons.ts`: expose default icon fallback and register edit-related icons.
- Modify `packages/web/src/stores/settings.ts`: clone, stage, and save one room override without clobbering other dirty settings.
- Modify `packages/web/src/components/RoomList.vue`: inline room edit UI and `save-room` event.
- Modify `packages/web/src/App.vue`: save room customization and refresh preview.
- Modify locale JSON files in `packages/web/src/locales/*.json`: add UI strings.
- Test files: settings store/route tests, generator tests, server pipeline tests, web settings store tests, RoomList tests, App integration tests.

## Task 1: Shared Settings Contract And Validation

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/server/src/storage/settings-store.ts`
- Modify: `packages/server/src/routes/settings.ts`
- Modify: `packages/web/src/api/types.ts`
- Test: `packages/server/src/storage/__tests__/settings-store.test.ts`
- Test: `packages/server/src/__tests__/routes/settings.test.ts`
- Test: `packages/web/src/__tests__/stores/settings.test.ts`

- [ ] **Step 1: Write failing storage tests for `roomOverrides`**

Add tests to `packages/server/src/storage/__tests__/settings-store.test.ts`:

```ts
it('round-trips roomOverrides through save and get', () => {
  const store = new SettingsStore(':memory:')
  try {
    store.save({
      ...DEFAULT_SETTINGS,
      roomOverrides: {
        kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
      },
    })

    expect(store.get().roomOverrides).toEqual({
      kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
    })
  } finally {
    store.close()
  }
})

it('falls back to DEFAULT_SETTINGS when roomOverrides has a non-object value', () => {
  const store = new SettingsStore(':memory:')
  try {
    const db = (store as unknown as { db: import('better-sqlite3').Database }).db
    db.prepare('INSERT OR REPLACE INTO settings (id, payload) VALUES (1, ?)').run(
      JSON.stringify({ ...DEFAULT_SETTINGS, roomOverrides: [] }),
    )

    expect(store.get()).toEqual(DEFAULT_SETTINGS)
  } finally {
    store.close()
  }
})

it('falls back to DEFAULT_SETTINGS when a room override field has the wrong type', () => {
  const store = new SettingsStore(':memory:')
  try {
    const db = (store as unknown as { db: import('better-sqlite3').Database }).db
    db.prepare('INSERT OR REPLACE INTO settings (id, payload) VALUES (1, ?)').run(
      JSON.stringify({
        ...DEFAULT_SETTINGS,
        roomOverrides: { kitchen: { name: 'Kitchen', icon: 123 } },
      }),
    )

    expect(store.get()).toEqual(DEFAULT_SETTINGS)
  } finally {
    store.close()
  }
})
```

- [ ] **Step 2: Run storage tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/server test -- settings-store.test.ts
```

Expected: FAIL because `Settings` has no `roomOverrides` field yet, or because malformed persisted `roomOverrides` is accepted.

- [ ] **Step 3: Write failing route tests for `roomOverrides`**

In `packages/server/src/__tests__/routes/settings.test.ts`, add `roomOverrides` to `VALID_BODY.settings`:

```ts
roomOverrides: {
  kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
},
```

Add route tests:

```ts
it('round-trips roomOverrides through PUT/GET', async () => {
  const app = await makeApp()
  try {
    const body = {
      settings: {
        ...VALID_BODY.settings,
        roomOverrides: {
          kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
        },
      },
    }
    await app.inject({ method: 'PUT', url: '/api/settings', payload: body })
    const res = await app.inject({ method: 'GET', url: '/api/settings' })
    expect(res.json().settings.roomOverrides).toEqual(body.settings.roomOverrides)
  } finally {
    await app.close()
  }
})

it('returns 400 invalid_body when roomOverrides contains a non-string name', async () => {
  const app = await makeApp()
  try {
    const bad = {
      settings: { ...VALID_BODY.settings, roomOverrides: { kitchen: { name: 42 } } },
    }
    const res = await app.inject({ method: 'PUT', url: '/api/settings', payload: bad })
    expect(res.statusCode).toBe(400)
    expect(res.json()).toMatchObject({ error: 'invalid_body' })
  } finally {
    await app.close()
  }
})
```

- [ ] **Step 4: Run route tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/server test -- routes/settings.test.ts
```

Expected: FAIL because the PUT schema strips or rejects `roomOverrides`.

- [ ] **Step 5: Implement shared and web API types**

In `packages/shared/src/types.ts`, add before `Settings`:

```ts
export interface RoomDisplayOverride {
  name?: string
  icon?: string
  showNameOnCard?: boolean
}
```

Add to `Settings`:

```ts
  /**
   * Optional user-preferred room display metadata keyed by analyzed room id.
   * Missing fields fall back to detected/canonical defaults.
   */
  roomOverrides?: Record<string, RoomDisplayOverride>
```

Mirror the same interface and field in `packages/web/src/api/types.ts`.

- [ ] **Step 6: Implement storage validation**

In `packages/server/src/storage/settings-store.ts`, import `RoomDisplayOverride` and add to `isSettings`:

```ts
  if (v.roomOverrides !== undefined && !isRoomOverrides(v.roomOverrides)) return false
```

Add helper:

```ts
function isRoomOverrides(value: unknown): value is Record<string, RoomDisplayOverride> {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return false
  for (const [roomId, override] of Object.entries(value)) {
    if (roomId.length === 0) return false
    if (typeof override !== 'object' || override === null || Array.isArray(override)) return false
    const record = override as Record<string, unknown>
    if (record.name !== undefined && typeof record.name !== 'string') return false
    if (record.icon !== undefined && typeof record.icon !== 'string') return false
    if (record.showNameOnCard !== undefined && typeof record.showNameOnCard !== 'boolean') {
      return false
    }
  }
  return true
}
```

- [ ] **Step 7: Implement route validation and shape preservation**

In `packages/server/src/routes/settings.ts`, add:

```ts
const RoomOverrideSchema = z.object({
  name: z.string().optional(),
  icon: z.string().optional(),
  showNameOnCard: z.boolean().optional(),
})
```

Add to `PutBodySchema.settings`:

```ts
    roomOverrides: z.record(RoomOverrideSchema).optional(),
```

Add to the `next: Settings` object:

```ts
        ...(data.roomOverrides !== undefined && { roomOverrides: data.roomOverrides }),
```

- [ ] **Step 8: Add web settings store clone support**

In `packages/web/src/stores/settings.ts`, update `cloneSettings`:

```ts
    if (settings.roomOverrides !== undefined) {
      next.roomOverrides = cloneRoomOverrides(settings.roomOverrides)
    }
```

Add helper near `cloneSettings`:

```ts
function cloneRoomOverrides(
  roomOverrides: NonNullable<Settings['roomOverrides']>,
): NonNullable<Settings['roomOverrides']> {
  return Object.fromEntries(
    Object.entries(roomOverrides).map(([roomId, override]) => [roomId, { ...override }]),
  )
}
```

- [ ] **Step 9: Run contract tests and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/server test -- settings-store.test.ts routes/settings.test.ts
pnpm --filter @lovelacer/web test -- stores/settings.test.ts
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 10: Commit Task 1**

```bash
git add packages/shared/src/types.ts packages/server/src/storage/settings-store.ts packages/server/src/routes/settings.ts packages/web/src/api/types.ts packages/server/src/storage/__tests__/settings-store.test.ts packages/server/src/__tests__/routes/settings.test.ts packages/web/src/__tests__/stores/settings.test.ts
git commit -m "feat(settings): persist room display overrides"
```

## Task 2: Generator Room Display Overrides

**Files:**
- Modify: `packages/generator/src/rooms.ts`
- Modify: `packages/generator/src/room-view.ts`
- Modify: `packages/generator/src/home-view.ts`
- Test: `packages/generator/src/__tests__/room-view.test.ts`
- Test: `packages/generator/src/__tests__/home-view.test.ts`

- [ ] **Step 1: Write failing room view tests**

Add to `packages/generator/src/__tests__/room-view.test.ts`:

```ts
it('uses room display overrides for title and icon while keeping canonical path', () => {
  const view = buildRoomView(grouping('kitchen', []), {
    kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' },
  })

  expect(view.title).toBe('Breakfast nook')
  expect(view.icon).toBe('mdi:coffee')
  expect(view.path).toBe('kitchen')
})

it('falls back field-by-field when a room display override is partial', () => {
  const view = buildRoomView(grouping('kitchen', []), {
    kitchen: { icon: 'mdi:coffee' },
  })

  expect(view.title).toBe('Kitchen')
  expect(view.icon).toBe('mdi:coffee')
})
```

- [ ] **Step 2: Run room view tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/generator test -- room-view.test.ts
```

Expected: FAIL because `buildRoomView` does not accept display overrides.

- [ ] **Step 3: Write failing home view tests**

Add to `packages/generator/src/__tests__/home-view.test.ts` near active/floor room tests:

```ts
it('uses room display overrides for active room card names', () => {
  const view = buildHomeView({
    entities: [ent('light.kitchen_ceiling')],
    groupings: [
      { roomId: 'kitchen', groups: [{ key: 'lights', entities: [ent('light.kitchen_ceiling')] }] },
    ],
    rooms: [{ id: 'kitchen', haAreaId: null, displayName: 'Kitchen', entityCount: 1, averageConfidence: 1, assignments: [] }],
    floorAssignments: new Map(),
    sections: { ...ALL_SECTIONS_ON, welcome: false, quickStats: false, people: false, roomsByFloor: false, scenes: false, cameras: false },
    roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
  })

  const card = view.sections[0]!.cards[0] as { card: { name?: string } }
  expect(card.card.name).toBe('Breakfast nook')
})

it('omits active room card name when showNameOnCard is false', () => {
  const view = buildHomeView({
    entities: [ent('light.kitchen_ceiling')],
    groupings: [
      { roomId: 'kitchen', groups: [{ key: 'lights', entities: [ent('light.kitchen_ceiling')] }] },
    ],
    rooms: [{ id: 'kitchen', haAreaId: null, displayName: 'Kitchen', entityCount: 1, averageConfidence: 1, assignments: [] }],
    floorAssignments: new Map(),
    sections: { ...ALL_SECTIONS_ON, welcome: false, quickStats: false, people: false, roomsByFloor: false, scenes: false, cameras: false },
    roomOverrides: { kitchen: { name: 'Breakfast nook', showNameOnCard: false } },
  })

  const card = view.sections[0]!.cards[0] as { card: { name?: string } }
  expect(card.card.name).toBeUndefined()
})
```

- [ ] **Step 4: Run home view tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/generator test -- home-view.test.ts
```

Expected: FAIL because `BuildHomeViewInput` has no `roomOverrides` field and home cards always set room names.

- [ ] **Step 5: Implement room display resolver**

In `packages/generator/src/rooms.ts`, import the override type and add:

```ts
import type { CanonicalRoomId, RoomDisplayOverride } from '@lovelacer/shared'
```

Add:

```ts
export type RoomDisplayOverrides = Partial<Record<CanonicalRoomId, RoomDisplayOverride>>

export function resolveRoomDisplay(
  roomId: CanonicalRoomId,
  overrides: RoomDisplayOverrides = {},
): RoomDisplay {
  const base = roomIdToDisplay(roomId)
  const override = overrides[roomId]
  return {
    title: override?.name?.trim() ? override.name.trim() : base.title,
    path: base.path,
    icon: override?.icon?.trim() ? override.icon.trim() : base.icon,
  }
}

export function shouldShowRoomNameOnCard(
  roomId: CanonicalRoomId,
  overrides: RoomDisplayOverrides = {},
): boolean {
  return overrides[roomId]?.showNameOnCard !== false
}
```

- [ ] **Step 6: Apply overrides to room views**

In `packages/generator/src/room-view.ts`, replace `roomIdToDisplay` usage:

```ts
import { resolveRoomDisplay, type RoomDisplayOverrides } from './rooms.js'
```

Change signatures:

```ts
export function buildRoomView(
  grouping: RoomGrouping,
  roomOverrides: RoomDisplayOverrides = {},
): RoomView {
  const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
```

```ts
export function buildRoomViews(
  groupings: RoomGrouping[],
  roomOverrides: RoomDisplayOverrides = {},
): RoomView[] {
  return groupings
    .filter((g) => g.groups.length > 0)
    .map((g) => buildRoomView(g, roomOverrides))
}
```

- [ ] **Step 7: Apply overrides to home room cards**

In `packages/generator/src/home-view.ts`, import:

```ts
import {
  resolveRoomDisplay,
  shouldShowRoomNameOnCard,
  type RoomDisplayOverrides,
} from './rooms.js'
```

Add to `BuildHomeViewInput`:

```ts
  roomOverrides?: RoomDisplayOverrides
```

Thread `roomOverrides: input.roomOverrides ?? {}` into `buildRoomsByFloorSection` and `buildActiveRoomsSection`.

Change `buildActiveRoomsSection` signature:

```ts
export function buildActiveRoomsSection(
  groupings: RoomGrouping[],
  roomOverrides: RoomDisplayOverrides = {},
): GridSection | null {
```

Inside it:

```ts
    const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
    const tile: TileCard = {
      type: 'tile',
      entity: primary.entityId,
      ...(shouldShowRoomNameOnCard(grouping.roomId, roomOverrides) ? { name: display.title } : {}),
      tap_action: { action: 'navigate', navigation_path: display.path },
    }
```

Add `roomOverrides?: RoomDisplayOverrides` to `BuildRoomsByFloorSectionInput`, pass it to `buildFloorGlance`, and in `buildFloorGlance` use the same `resolveRoomDisplay` plus conditional `name` spread for entries.

- [ ] **Step 8: Run generator tests and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/generator test -- room-view.test.ts home-view.test.ts
pnpm --filter @lovelacer/generator typecheck
```

Expected: PASS.

- [ ] **Step 9: Commit Task 2**

```bash
git add packages/generator/src/rooms.ts packages/generator/src/room-view.ts packages/generator/src/home-view.ts packages/generator/src/__tests__/room-view.test.ts packages/generator/src/__tests__/home-view.test.ts
git commit -m "feat(generator): apply room display overrides"
```

## Task 3: Server Pipeline Applies Effective Room Metadata

**Files:**
- Modify: `packages/shared/src/types.ts`
- Modify: `packages/server/src/pipeline.ts`
- Test: `packages/server/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing pipeline tests**

Update the shared type import in `packages/server/src/__tests__/pipeline.test.ts`:

```ts
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
  Settings,
} from '@lovelacer/shared'
```

Add this helper after `makeSettingsWithRoomOrder`:

```ts
function makeSettingsWithRoomOverrides(roomOverrides: Settings['roomOverrides']): SettingsStore {
  const settings = makeSettings()
  settings.save({ ...settings.get(), roomOverrides })
  return settings
}
```

Add these tests:

```ts
it('applies room display overrides to analyze output', async () => {
  const fake = makeFakeHa()
  const settings = makeSettingsWithRoomOverrides({
    kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' },
  })
  try {
    const result = await runAnalyze(fake.client, makeStore(), settings)
    const kitchen = result.rooms.find((room) => room.id === 'kitchen')
    expect(kitchen?.displayName).toBe('Breakfast nook')
    expect(kitchen?.icon).toBe('mdi:coffee')
  } finally {
    settings.close()
  }
})

it('applies room display overrides to generated preview views', async () => {
  const fake = makeFakeHa()
  const appliedSnapshot = makeAppliedSnapshot()
  const dismissed = makeDismissed()
  const settings = makeSettingsWithRoomOverrides({
    kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' },
  })
  try {
    const result = await runPreview(
      fake.client,
      makeStore(),
      appliedSnapshot,
      dismissed,
      settings,
    )
    const view = result.config.views.find((candidate) => candidate.path === 'kitchen')
    expect(view?.title).toBe('Breakfast nook')
    expect(view?.icon).toBe('mdi:coffee')
  } finally {
    settings.close()
  }
})
```

- [ ] **Step 2: Run pipeline tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/server test -- pipeline.test.ts
```

Expected: FAIL because `AnalyzedRoom` has no `icon` field and preview generation ignores `roomOverrides`.

- [ ] **Step 3: Add room icon to API model**

In `packages/shared/src/types.ts`, add to `AnalyzedRoom`:

```ts
  icon: string
```

In `packages/web/src/api/types.ts`, add the same field to `AnalyzedRoom`.

Update each test helper that constructs `AnalyzedRoom` to include an icon field:

- `packages/web/src/__tests__/components/RoomList.test.ts`: the `room()` helper returns `icon: 'mdi:silverware-fork-knife'`.
- `packages/web/src/__tests__/stores/analyze.test.ts`: room fixtures include `icon: 'mdi:silverware-fork-knife'`.
- `packages/web/src/__tests__/components/onboarding/PreviewStep.test.ts`: room fixtures include `icon: 'mdi:silverware-fork-knife'`.
- `packages/web/src/__tests__/App.test.ts`: kitchen rooms use `icon: 'mdi:silverware-fork-knife'`, bedroom rooms use `icon: 'mdi:bed'`, living room rooms use `icon: 'mdi:sofa'`.
- `packages/generator/src/__tests__/home-view.test.ts`: `AnalyzedRoom` literals include `icon: 'mdi:silverware-fork-knife'`.

- [ ] **Step 4: Resolve room overrides in pipeline**

In `packages/server/src/pipeline.ts`, import:

```ts
import { resolveRoomDisplay, type RoomDisplayOverrides } from '@lovelacer/generator'
```

Add to `PipelineState`:

```ts
  roomOverrides: RoomDisplayOverrides
```

After reading settings:

```ts
  const roomOverrides = (cfg.roomOverrides ?? {}) as RoomDisplayOverrides
```

Pass `roomOverrides` to `buildAnalyzedRoom`.

Update `buildAnalyzedRoom` signature:

```ts
function buildAnalyzedRoom(
  grouping: RoomGrouping,
  roomAssignments: RoomAssignment[],
  entityById: ReadonlyMap<string, NormalizedEntity>,
  areas: HaAreaRegistryEntry[],
  roomOverrides: RoomDisplayOverrides,
): AnalyzedRoom {
```

Inside `buildAnalyzedRoom`:

```ts
  const display = resolveRoomDisplay(grouping.roomId, roomOverrides)
  const detectedDisplayName =
    haAreaId !== null
      ? (areas.find((a) => a.area_id === haAreaId)?.name ?? CANONICAL_ROOM_NAMES[grouping.roomId])
      : CANONICAL_ROOM_NAMES[grouping.roomId]
  const displayName = roomOverrides[grouping.roomId]?.name?.trim()
    ? display.title
    : detectedDisplayName
```

Return:

```ts
    displayName,
    icon: display.icon,
```

In `runFullPipeline` return `roomOverrides`.

In `runPreview`, add `roomOverrides: state.roomOverrides` to the existing `buildHomeView` object literal:

```ts
buildHomeView({
  entities: state.entities.filter(
    (entity) =>
      state.dashboardEntityIds.has(entity.entityId) || homeQuickStatsIds.has(entity.entityId),
  ),
  groupings: dashboardGroupings,
  rooms: state.rooms,
  floorAssignments: state.floorAssignments,
  sections: state.sectionFlags,
  roomOverrides: state.roomOverrides,
})
```

Pass the same map to room view generation:

```ts
buildRoomViews(dashboardGroupings, state.roomOverrides)
```

- [ ] **Step 5: Run pipeline tests and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/server test -- pipeline.test.ts
pnpm --filter @lovelacer/server typecheck
pnpm --filter @lovelacer/web typecheck
```

Expected: PASS.

- [ ] **Step 6: Commit Task 3**

```bash
git add packages/shared/src/types.ts packages/web/src/api/types.ts packages/server/src/pipeline.ts packages/server/src/__tests__/pipeline.test.ts packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/stores/analyze.test.ts packages/web/src/__tests__/components/onboarding/PreviewStep.test.ts packages/web/src/__tests__/App.test.ts packages/generator/src/__tests__/home-view.test.ts
git commit -m "feat(server): surface effective room metadata"
```

## Task 4: Web Store Save Helper For One Room Override

**Files:**
- Modify: `packages/web/src/stores/settings.ts`
- Test: `packages/web/src/__tests__/stores/settings.test.ts`

- [ ] **Step 1: Write failing store tests**

Add to `packages/web/src/__tests__/stores/settings.test.ts`:

```ts
it('setRoomOverride stages a sanitized room override', async () => {
  vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
  const store = useSettingsStore()
  await store.loadFromServer()

  store.setRoomOverride('kitchen', {
    name: '  Breakfast nook  ',
    icon: '  mdi:coffee  ',
    showNameOnCard: false,
  })

  expect(store.dirtyState?.roomOverrides).toEqual({
    kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
  })
})

it('setRoomOverride removes empty room override entries', async () => {
  const saved: Settings = {
    ...DEFAULT_SETTINGS,
    roomOverrides: { kitchen: { name: 'Breakfast nook' } },
  }
  vi.mocked(getSettings).mockResolvedValueOnce({ settings: saved })
  const store = useSettingsStore()
  await store.loadFromServer()

  store.setRoomOverride('kitchen', { name: '', icon: '', showNameOnCard: true })

  expect(store.dirtyState?.roomOverrides).toBeUndefined()
})

it('saveRoomOverride saves one room override and preserves existing dirty settings', async () => {
  const savedSettings: Settings = {
    ...DEFAULT_SETTINGS,
    roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
  }
  vi.mocked(getSettings).mockResolvedValueOnce({ settings: DEFAULT_SETTINGS })
  vi.mocked(putSettings).mockResolvedValueOnce({ settings: savedSettings })
  const store = useSettingsStore()
  await store.loadFromServer()
  store.setLanguage('cs')

  await store.saveRoomOverride('kitchen', { name: 'Breakfast nook', icon: 'mdi:coffee' })

  expect(vi.mocked(putSettings)).toHaveBeenCalledWith({ settings: savedSettings })
  expect(store.serverState).toEqual(savedSettings)
  expect(store.dirtyState?.language).toBe('cs')
  expect(store.dirtyState?.roomOverrides).toEqual(savedSettings.roomOverrides)
})
```

- [ ] **Step 2: Run store tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/web test -- stores/settings.test.ts
```

Expected: FAIL because `setRoomOverride` and `saveRoomOverride` do not exist.

- [ ] **Step 3: Implement room override sanitizing and dirty helpers**

In `packages/web/src/stores/settings.ts`, import `RoomDisplayOverride`.

Add helpers:

```ts
function sanitizeRoomOverride(override: RoomDisplayOverride): RoomDisplayOverride | null {
  const next: RoomDisplayOverride = {}
  const name = override.name?.trim()
  const icon = override.icon?.trim()
  if (name) next.name = name
  if (icon) next.icon = icon
  if (override.showNameOnCard === false) next.showNameOnCard = false
  return Object.keys(next).length === 0 ? null : next
}

function withRoomOverride(
  settings: Settings | null,
  roomId: string,
  override: RoomDisplayOverride | null,
): Settings | null {
  if (settings === null) return null
  const next = cloneSettings(settings)
  const roomOverrides = cloneRoomOverrides(next.roomOverrides ?? {})
  if (override === null) {
    delete roomOverrides[roomId]
  } else {
    roomOverrides[roomId] = { ...override }
  }
  if (Object.keys(roomOverrides).length === 0) {
    delete next.roomOverrides
  } else {
    next.roomOverrides = roomOverrides
  }
  return next
}
```

Add actions:

```ts
function setRoomOverride(roomId: string, override: RoomDisplayOverride): void {
  dirtyState.value = withRoomOverride(cloneEffective(), roomId, sanitizeRoomOverride(override))
}

async function saveRoomOverride(roomId: string, override: RoomDisplayOverride): Promise<void> {
  if (serverState.value === null) return

  const sanitized = sanitizeRoomOverride(override)
  const previousDirty = snapshotDirtyState()
  const previousOverride = previousDirty?.roomOverrides?.[roomId] ?? serverState.value.roomOverrides?.[roomId]
  setRoomOverride(roomId, override)
  const optimisticDirty = snapshotDirtyState()

  return enqueueSettingsWrite(async () => {
    if (serverState.value === null) return
    phase.value = 'saving'
    error.value = null
    const next = withRoomOverride(serverState.value, roomId, sanitized)
    if (next === null) return

    try {
      const result = await putSettings({ settings: next })
      replaceServerState(result.settings)
      const savedOverride = result.settings.roomOverrides?.[roomId] ?? null
      if (settingsEqual(dirtyState.value, optimisticDirty)) {
        dirtyState.value = withRoomOverride(previousDirty, roomId, savedOverride)
      } else {
        dirtyState.value = withRoomOverride(dirtyState.value, roomId, savedOverride)
      }
      reconcileDirtyWithServer()
      phase.value = 'idle'
    } catch (err) {
      if (settingsEqual(dirtyState.value, optimisticDirty)) {
        dirtyState.value = withRoomOverride(previousDirty, roomId, previousOverride ?? null)
      } else {
        dirtyState.value = withRoomOverride(dirtyState.value, roomId, previousOverride ?? null)
      }
      reconcileDirtyWithServer()
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  })
}
```

Return both actions from the store.

- [ ] **Step 4: Run store tests and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/web test -- stores/settings.test.ts
pnpm --filter @lovelacer/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 4**

```bash
git add packages/web/src/stores/settings.ts packages/web/src/__tests__/stores/settings.test.ts
git commit -m "feat(web): add room override settings actions"
```

## Task 5: RoomList Inline Editing UI

**Files:**
- Modify: `packages/web/src/components/RoomList.vue`
- Modify: `packages/web/src/icons.ts`
- Modify: `packages/web/src/locales/en.json`
- Modify: `packages/web/src/locales/cs.json`
- Modify: `packages/web/src/locales/de.json`
- Test: `packages/web/src/__tests__/components/RoomList.test.ts`

- [ ] **Step 1: Write failing RoomList tests**

Add to `packages/web/src/__tests__/components/RoomList.test.ts`:

```ts
it('emits save-room when inline room metadata is saved', async () => {
  const wrapper = mount(RoomList, {
    props: { rooms: [room({ id: 'kitchen', displayName: 'Kitchen', icon: 'mdi:silverware-fork-knife' })] },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })

  await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
  await wrapper.find('[data-testid="room-name-input"]').setValue('Breakfast nook')
  await wrapper.find('[data-testid="room-icon-input"]').setValue('mdi:coffee')
  await wrapper.find('[data-testid="room-show-name-toggle"]').setValue(false)
  await wrapper.find('[data-testid="room-save-button"]').trigger('click')

  expect(wrapper.emitted('save-room')?.[0]).toEqual([
    'kitchen',
    { name: 'Breakfast nook', icon: 'mdi:coffee', showNameOnCard: false },
  ])
})

it('emits save-room with empty values when reset is clicked', async () => {
  const wrapper = mount(RoomList, {
    props: { rooms: [room({ id: 'kitchen', displayName: 'Breakfast nook', icon: 'mdi:coffee' })] },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })

  await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
  await wrapper.find('[data-testid="room-reset-button"]').trigger('click')

  expect(wrapper.emitted('save-room')?.[0]).toEqual([
    'kitchen',
    { name: '', icon: '', showNameOnCard: true },
  ])
})

it('does not render room edit controls in read-only mode', () => {
  const wrapper = mount(RoomList, {
    props: { rooms: [room()], readOnly: true },
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn }), createTestI18n()],
    },
  })

  expect(wrapper.find('[data-testid="room-edit-button"]').exists()).toBe(false)
})
```

- [ ] **Step 2: Run RoomList tests and verify RED**

Run:

```bash
pnpm --filter @lovelacer/web test -- RoomList.test.ts
```

Expected: FAIL because the edit controls and `save-room` emit do not exist.

- [ ] **Step 3: Implement RoomList props, emits, and state**

In `RoomList.vue`, update imports:

```ts
import type { AnalyzedRoom, EntityDiff, RoomDiffSummary, RoomDisplayOverride } from '../api/types.js'
```

Update emits:

```ts
const emit = defineEmits<{
  reorder: [roomIds: string[]]
  saveRoom: [roomId: string, override: RoomDisplayOverride]
}>()
```

Add refs and helpers:

```ts
const editingRoomId = ref<string | null>(null)
const editName = ref('')
const editIcon = ref('')
const editShowNameOnCard = ref(true)

function openRoomEdit(room: AnalyzedRoom): void {
  editingRoomId.value = room.id
  editName.value = room.displayName
  editIcon.value = room.icon
  editShowNameOnCard.value = true
}

function saveRoomEdit(roomId: string): void {
  emit('saveRoom', roomId, {
    name: editName.value,
    icon: editIcon.value,
    showNameOnCard: editShowNameOnCard.value,
  })
  editingRoomId.value = null
}

function resetRoomEdit(roomId: string): void {
  emit('saveRoom', roomId, { name: '', icon: '', showNameOnCard: true })
  editingRoomId.value = null
}
```

- [ ] **Step 4: Implement RoomList template controls**

Replace the icon binding:

```vue
<Icon :icon="room.icon" class="h-5 w-5 text-stone-700" />
```

Add the edit button inside the summary left cluster when not read-only:

```vue
<button
  v-if="readOnly !== true"
  type="button"
  data-testid="room-edit-button"
  :aria-label="t('roomList.editRoom', { room: room.displayName })"
  :title="t('roomList.editRoom', { room: room.displayName })"
  class="rounded p-1 text-stone-400 hover:bg-stone-100 hover:text-stone-700"
  @click.prevent.stop="openRoomEdit(room)"
>
  <Icon icon="mdi:pencil" class="h-4 w-4" />
</button>
```

Add after `</summary>` and before the entity `<ul>`:

```vue
<div
  v-if="editingRoomId === room.id"
  class="grid gap-3 border-t border-stone-100 bg-stone-50 px-5 py-4 sm:grid-cols-[1fr_14rem_auto_auto]"
>
  <label class="block">
    <span class="mb-1 block text-xs font-medium text-stone-600">{{ t('roomList.nameLabel') }}</span>
    <input
      v-model="editName"
      data-testid="room-name-input"
      class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
    />
  </label>
  <label class="block">
    <span class="mb-1 block text-xs font-medium text-stone-600">{{ t('roomList.iconLabel') }}</span>
    <input
      v-model="editIcon"
      data-testid="room-icon-input"
      class="w-full rounded border border-stone-300 bg-white px-3 py-2 text-sm text-stone-800 focus:border-amber-500 focus:outline-none focus:ring-2 focus:ring-amber-100"
    />
  </label>
  <label class="flex items-center gap-2 self-end pb-2 text-sm text-stone-700">
    <input v-model="editShowNameOnCard" data-testid="room-show-name-toggle" type="checkbox" />
    <span>{{ t('roomList.showNameOnCard') }}</span>
  </label>
  <div class="flex items-end gap-2">
    <button
      type="button"
      data-testid="room-reset-button"
      class="rounded border border-stone-300 bg-white px-3 py-2 text-xs font-medium text-stone-700 hover:bg-stone-100"
      @click="resetRoomEdit(room.id)"
    >
      {{ t('roomList.reset') }}
    </button>
    <button
      type="button"
      data-testid="room-save-button"
      class="rounded bg-stone-900 px-3 py-2 text-xs font-medium text-white hover:bg-stone-700"
      @click="saveRoomEdit(room.id)"
    >
      {{ t('roomList.save') }}
    </button>
  </div>
</div>
```

- [ ] **Step 5: Register edit icon and locale strings**

In `packages/web/src/icons.ts`, import:

```ts
import pencil from '@iconify-icons/mdi/pencil'
```

Add:

```ts
  'mdi:pencil': pencil,
```

Add English locale keys:

```json
"roomList.editRoom": "Edit {room}",
"roomList.iconLabel": "Icon",
"roomList.nameLabel": "Room name",
"roomList.reset": "Reset",
"roomList.save": "Save",
"roomList.showNameOnCard": "Show name on card"
```

Add equivalent keys to `cs.json` and `de.json`. English fallback text is acceptable if translations are not available, but keys must exist for locale completeness tests.

- [ ] **Step 6: Run RoomList tests and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/web test -- RoomList.test.ts locale-completeness.test.ts
pnpm --filter @lovelacer/web typecheck
```

Expected: PASS.

- [ ] **Step 7: Commit Task 5**

```bash
git add packages/web/src/components/RoomList.vue packages/web/src/icons.ts packages/web/src/locales/en.json packages/web/src/locales/cs.json packages/web/src/locales/de.json packages/web/src/__tests__/components/RoomList.test.ts
git commit -m "feat(web): add inline room customization"
```

## Task 6: App Wiring And Preview Refresh

**Files:**
- Modify: `packages/web/src/App.vue`
- Test: `packages/web/src/__tests__/App.test.ts`

- [ ] **Step 1: Write failing App test**

Add to `packages/web/src/__tests__/App.test.ts`:

```ts
it('saves a room override and refreshes preview', async () => {
  mockInviteAccepted()
  mockOnboardingComplete()
  vi.mocked(getSettings).mockResolvedValue({ settings: DEFAULT_SETTINGS })
  vi.mocked(postPreview)
    .mockResolvedValueOnce(makePreview({
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Kitchen',
          icon: 'mdi:silverware-fork-knife',
          entityCount: 1,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }))
    .mockResolvedValueOnce(makePreview({
      rooms: [
        {
          id: 'kitchen',
          haAreaId: 'kitchen',
          displayName: 'Breakfast nook',
          icon: 'mdi:coffee',
          entityCount: 1,
          averageConfidence: 1,
          assignments: [],
        },
      ],
    }))
  vi.mocked(putSettings).mockResolvedValueOnce({
    settings: {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
    },
  })

  const wrapper = mountApp()
  await flushPromises()
  await wrapper.find('[data-testid="room-edit-button"]').trigger('click')
  await wrapper.find('[data-testid="room-name-input"]').setValue('Breakfast nook')
  await wrapper.find('[data-testid="room-icon-input"]').setValue('mdi:coffee')
  await wrapper.find('[data-testid="room-save-button"]').trigger('click')
  await flushPromises()

  expect(putSettings).toHaveBeenCalledWith({
    settings: {
      ...DEFAULT_SETTINGS,
      roomOverrides: { kitchen: { name: 'Breakfast nook', icon: 'mdi:coffee' } },
    },
  })
  expect(postPreview).toHaveBeenCalledTimes(2)
  expect(wrapper.find('[data-testid="room-name"]').text()).toBe('Breakfast nook')
})
```

Use existing test helpers in `App.test.ts`; keep the same naming conventions if helper names differ.

- [ ] **Step 2: Run App test and verify RED**

Run:

```bash
pnpm --filter @lovelacer/web test -- App.test.ts
```

Expected: FAIL because `RoomList` is not wired to save room customization.

- [ ] **Step 3: Implement App save handler**

In `packages/web/src/App.vue`, import:

```ts
import type { EntityDiff, RoomDiffSummary, RoomDisplayOverride } from './api/types.js'
```

Add state:

```ts
const roomOverrideSaveInFlight = ref(false)
```

Add handler:

```ts
async function saveRoomOverride(roomId: string, override: RoomDisplayOverride): Promise<void> {
  if (settings.serverState === null) {
    await settings.loadFromServer()
  }
  if (settings.serverState === null) return
  roomOverrideSaveInFlight.value = true
  try {
    await settings.saveRoomOverride(roomId, override)
    await analyze.refreshPreview()
  } catch {
    // Settings/analyze stores own their visible error state.
  } finally {
    roomOverrideSaveInFlight.value = false
  }
}
```

Update the `RoomList` usage:

```vue
@save-room="saveRoomOverride"
```

Update `ApplyBar` guard:

```vue
<ApplyBar v-if="!roomOrderSaveInFlight && !roomOverrideSaveInFlight && !analyze.isRefreshingPreview" />
```

- [ ] **Step 4: Run App test and verify GREEN**

Run:

```bash
pnpm --filter @lovelacer/web test -- App.test.ts
pnpm --filter @lovelacer/web typecheck
```

Expected: PASS.

- [ ] **Step 5: Commit Task 6**

```bash
git add packages/web/src/App.vue packages/web/src/__tests__/App.test.ts
git commit -m "feat(web): save room customization from review"
```

## Task 7: Final Verification

**Files:**
- Verify all modified files.

- [ ] **Step 1: Run focused package tests**

Run:

```bash
pnpm --filter @lovelacer/server test -- settings-store.test.ts routes/settings.test.ts pipeline.test.ts
pnpm --filter @lovelacer/generator test -- room-view.test.ts home-view.test.ts
pnpm --filter @lovelacer/web test -- stores/settings.test.ts RoomList.test.ts App.test.ts locale-completeness.test.ts
```

Expected: PASS.

- [ ] **Step 2: Run repository typecheck**

Run:

```bash
pnpm typecheck
```

Expected: PASS.

- [ ] **Step 3: Run full test suite**

Run:

```bash
pnpm test
```

Expected: PASS.

- [ ] **Step 4: Run lint**

Run:

```bash
pnpm lint
```

Expected: PASS.

- [ ] **Step 5: Commit any verification fixes**

If verification required fixes, stage the source and test files touched by this feature:

```bash
git add packages/shared/src/types.ts packages/server/src/storage/settings-store.ts packages/server/src/routes/settings.ts packages/server/src/pipeline.ts packages/web/src/api/types.ts packages/web/src/stores/settings.ts packages/web/src/components/RoomList.vue packages/web/src/App.vue packages/web/src/icons.ts packages/web/src/locales/en.json packages/web/src/locales/cs.json packages/web/src/locales/de.json packages/generator/src/rooms.ts packages/generator/src/room-view.ts packages/generator/src/home-view.ts packages/server/src/storage/__tests__/settings-store.test.ts packages/server/src/__tests__/routes/settings.test.ts packages/server/src/__tests__/pipeline.test.ts packages/web/src/__tests__/stores/settings.test.ts packages/web/src/__tests__/components/RoomList.test.ts packages/web/src/__tests__/App.test.ts packages/generator/src/__tests__/room-view.test.ts packages/generator/src/__tests__/home-view.test.ts
git commit -m "fix: stabilize room customization"
```

If no fixes were needed, do not create an empty commit.
