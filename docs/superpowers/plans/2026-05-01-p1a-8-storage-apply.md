# P1a-8 Storage-mode Apply Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the apply pipeline end-to-end. Wrap analyzer + generator output into a HA Lovelace `LovelaceConfig`, push it to HA via storage-mode WebSocket calls (`lovelace/dashboards/list` → `dashboards/create` → `config/save`), and expose `/api/analyze`, `/api/preview`, `/api/apply` Fastify routes that the P1a-10 frontend will drive.

**Architecture:** `buildLovelaceConfig` in `@lovelacer/generator` produces the `{ title, views }` envelope. `HaClient.applyDashboard` in `@lovelacer/ha-client` performs the three-call WS sequence with `HaApplyError({ step, cause })` on first failure. A shared `pipeline.ts` in `@lovelacer/server` exposes `runAnalyze`/`runPreview`/`runApply` that route handlers wrap thinly. `/api/apply` is hybrid: accepts an optional `LovelaceConfig` body or re-runs preview internally.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vitest (`globals: false`), Fastify (with built-in `app.inject()` for route tests), `home-assistant-js-websocket` (already wired in HaClient). No new runtime dependencies.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1a-8-storage-apply-design.md`](../specs/2026-05-01-p1a-8-storage-apply-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect, vi } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- If husky's lint-staged or `pnpm format:check` reports drift, run `pnpm --dir <worktree> format`, re-stage, and retry — recurring quirk in this repo.

---

## Task 1: `buildLovelaceConfig` + types + unit tests

**Files:**

- Create: `packages/generator/src/lovelace-config.ts`
- Create: `packages/generator/src/__tests__/lovelace-config.test.ts`
- Modify: `packages/generator/src/index.ts`

Pure function that wraps a `HomeView` and `RoomView[]` into the `{ title, views }` envelope HA expects. Rooms sorted alphabetically by view title using `localeCompare(_, 'en')`.

- [ ] **Step 1: Write the failing test**

Create `packages/generator/src/__tests__/lovelace-config.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { buildLovelaceConfig, type BuildLovelaceConfigInput } from '../lovelace-config.js'
import type { HomeView } from '../home-view.js'
import type { RoomView } from '../lovelace-types.js'

const home: HomeView = {
  type: 'sections',
  title: 'Home',
  path: 'home',
  icon: 'mdi:home-variant',
  sections: [],
}

function room(title: string, path: string): RoomView {
  return {
    type: 'sections',
    title,
    path,
    icon: 'mdi:home',
    sections: [],
  }
}

describe('buildLovelaceConfig — title and shape', () => {
  it('uses the literal title "Lovelacer — Home" (em dash)', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(result.title).toBe('Lovelacer — Home')
  })

  it('produces { title, views } shape', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(Object.keys(result).sort()).toEqual(['title', 'views'])
  })
})

describe('buildLovelaceConfig — view ordering', () => {
  it('home view comes first when no rooms', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    expect(result.views).toEqual([home])
  })

  it('home first, rooms alphabetical by title', () => {
    const input: BuildLovelaceConfigInput = {
      home,
      rooms: [
        room('Living Room', 'living_room'),
        room('Bedroom', 'bedroom'),
        room('Kitchen', 'kitchen'),
      ],
    }
    const result = buildLovelaceConfig(input)
    expect(result.views.map((v) => v.title)).toEqual(['Home', 'Bedroom', 'Kitchen', 'Living Room'])
  })

  it('alphabetical sort is case-insensitive (localeCompare default)', () => {
    const result = buildLovelaceConfig({
      home,
      rooms: [room('zen', 'a'), room('Apple', 'b'), room('banana', 'c')],
    })
    expect(result.views.map((v) => v.title).slice(1)).toEqual(['Apple', 'banana', 'zen'])
  })

  it('uses English locale for sort (Ž sorts after Z)', () => {
    const result = buildLovelaceConfig({
      home,
      rooms: [room('Žofie', 'a'), room('Anička', 'b')],
    })
    expect(result.views.map((v) => v.title).slice(1)).toEqual(['Anička', 'Žofie'])
  })
})

describe('buildLovelaceConfig — purity', () => {
  it('does not mutate the input rooms array', () => {
    const rooms = [room('Z', 'z'), room('A', 'a')]
    const before = rooms.map((r) => r.title)
    buildLovelaceConfig({ home, rooms })
    expect(rooms.map((r) => r.title)).toEqual(before)
  })

  it('same input → identical output (referentially-stable wrt input)', () => {
    const input: BuildLovelaceConfigInput = {
      home,
      rooms: [room('B', 'b'), room('A', 'a')],
    }
    const a = buildLovelaceConfig(input)
    const b = buildLovelaceConfig(input)
    expect(a).toEqual(b)
  })
})

describe('buildLovelaceConfig — view typing', () => {
  it('home view retained at index 0 with full HomeView fields', () => {
    const result = buildLovelaceConfig({ home, rooms: [] })
    const first = result.views[0]!
    expect(first.path).toBe('home')
    expect(first.icon).toBe('mdi:home-variant')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.test.ts
```

Expected: FAIL — module not found for `../lovelace-config.js`.

- [ ] **Step 3: Implement `lovelace-config.ts`**

Create `packages/generator/src/lovelace-config.ts`:

```ts
import type { HomeView } from './home-view.js'
import type { RoomView } from './lovelace-types.js'

/**
 * The full Lovelace dashboard envelope HA accepts via `lovelace/config/save`.
 * `views` is the home view first, followed by per-room views sorted by title.
 */
export interface LovelaceConfig {
  title: string
  views: (HomeView | RoomView)[]
}

export interface BuildLovelaceConfigInput {
  home: HomeView
  rooms: RoomView[]
}

const DASHBOARD_TITLE = 'Lovelacer — Home'

/**
 * Wrap the home view and room views into the `{ title, views }` envelope
 * HA's `lovelace/config/save` expects.
 *
 * Rooms are sorted alphabetically by view title using `localeCompare(_, 'en')`
 * — the same comparator P1a-5 uses for domain-group ordering. The home view
 * is always at index 0; rooms follow.
 *
 * Pure function. Doesn't mutate input.
 */
export function buildLovelaceConfig(input: BuildLovelaceConfigInput): LovelaceConfig {
  const sortedRooms = [...input.rooms].sort((a, b) => a.title.localeCompare(b.title, 'en'))
  return {
    title: DASHBOARD_TITLE,
    views: [input.home, ...sortedRooms],
  }
}
```

- [ ] **Step 4: Re-export from the package barrel**

Read `packages/generator/src/index.ts` first. Append below the existing exports (alphabetical with the other exports where it fits):

```ts
export { buildLovelaceConfig } from './lovelace-config.js'
export type { BuildLovelaceConfigInput, LovelaceConfig } from './lovelace-config.js'
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.test.ts
```

Expected: PASS — about 9 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/generator/src/lovelace-config.ts \
        packages/generator/src/__tests__/lovelace-config.test.ts \
        packages/generator/src/index.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(generator): buildLovelaceConfig + LovelaceConfig type

Pure function that wraps HomeView + RoomView[] into the { title, views }
envelope HA's lovelace/config/save expects. Title constant 'Lovelacer
— Home' (em dash). Rooms sorted alphabetically by title using the same
localeCompare(_, 'en') comparator P1a-5 uses for domain-group order.

P1a-8 layer 1 of 3 (generator). HA client apply mechanics in next task.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Fixture snapshot test for `buildLovelaceConfig`

**Files:**

- Create: `packages/generator/src/__tests__/lovelace-config.fixtures.test.ts`

End-to-end runs against `english-cluttered` and `czech-tidy`. Pipes through `fixtureToHaRegistries → normalize → detect → groupByDomain → buildHomeView + buildRoomViews → buildLovelaceConfig`. Locks structural snapshot (title, view paths, view count).

- [ ] **Step 1: Write the test file**

Create `packages/generator/src/__tests__/lovelace-config.fixtures.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { czechTidy } from '../../../../tests/fixtures/czech-tidy.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import type { Fixture } from '../../../../tests/fixtures/_builder/index.js'
import { detect, groupByDomain, normalize } from '@lovelacer/analyzer'
import { buildHomeView } from '../home-view.js'
import { buildLovelaceConfig } from '../lovelace-config.js'
import { buildRoomViews } from '../room-view.js'

function pipe(fixture: Fixture) {
  const ha = fixtureToHaRegistries(fixture)
  const entities = normalize({ entities: ha.entities, devices: ha.devices })
  const assignments = detect({ entities, areas: ha.areas })
  const groupings = groupByDomain({ assignments, entities })
  const home = buildHomeView({ entities })
  const rooms = buildRoomViews(groupings)
  const config = buildLovelaceConfig({ home, rooms })
  return { entities, config }
}

function summarize(config: ReturnType<typeof pipe>['config']) {
  return {
    title: config.title,
    viewCount: config.views.length,
    views: config.views.map((v) => ({ title: v.title, path: v.path })),
  }
}

describe('buildLovelaceConfig — english-cluttered fixture', () => {
  const { config } = pipe(englishCluttered)

  it('matches structural snapshot', () => {
    expect(summarize(config)).toMatchInlineSnapshot()
  })

  it('home view is at index 0', () => {
    expect(config.views[0]!.path).toBe('home')
  })

  it('every view path is unique', () => {
    const paths = config.views.map((v) => v.path)
    expect(paths.length).toBe(new Set(paths).size)
  })

  it('rooms after home are sorted alphabetically by title', () => {
    const roomTitles = config.views.slice(1).map((v) => v.title)
    const sorted = [...roomTitles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(roomTitles).toEqual(sorted)
  })
})

describe('buildLovelaceConfig — czech-tidy fixture', () => {
  const { config } = pipe(czechTidy)

  it('matches structural snapshot', () => {
    expect(summarize(config)).toMatchInlineSnapshot()
  })

  it('home view is at index 0', () => {
    expect(config.views[0]!.path).toBe('home')
  })

  it('every view path is unique', () => {
    const paths = config.views.map((v) => v.path)
    expect(paths.length).toBe(new Set(paths).size)
  })
})
```

- [ ] **Step 2: Generate the snapshots**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.fixtures.test.ts --update
```

Expected: PASS. The two `toMatchInlineSnapshot()` calls populate.

Open the file and inspect the snapshots:

- english-cluttered: title `'Lovelacer — Home'`, multiple views with `home` first then rooms in alphabetical order.
- czech-tidy: title `'Lovelacer — Home'`, `home` first then rooms.

Sanity-check before continuing. If the home view isn't at index 0, that's a real signal — STOP and report as DONE_WITH_CONCERNS.

- [ ] **Step 3: Re-run without `--update` to confirm stability**

```bash
pnpm --dir <worktree> vitest run packages/generator/src/__tests__/lovelace-config.fixtures.test.ts
```

Expected: PASS.

- [ ] **Step 4: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green. If `format:check` fails, run `pnpm --dir <worktree> format` and stage.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/generator/src/__tests__/lovelace-config.fixtures.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
test(generator): buildLovelaceConfig end-to-end on english-cluttered + czech-tidy

Pipes each fixture through the full generator pipeline (normalize →
detect → groupByDomain → buildHomeView + buildRoomViews →
buildLovelaceConfig) and locks the structural snapshot (title, view
count, per-view title + path).

Anti-regression: home view at index 0, every view path unique, rooms
after home sorted alphabetically.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: HA Client `applyDashboard` + `listDashboards` + `HaApplyError`

**Files:**

- Create: `packages/ha-client/src/dashboards.ts`
- Create: `packages/ha-client/src/__tests__/dashboards.test.ts`
- Modify: `packages/ha-client/src/client.ts`
- Modify: `packages/ha-client/src/index.ts`

Add the apply mechanics to `HaClient`. New file `dashboards.ts` holds the supporting types, `DEFAULT_OPTIONS`, and `HaApplyError`. Methods live on the existing `HaClient` class (no second client, no DashboardClient extraction).

- [ ] **Step 1: Write the failing tests**

Create `packages/ha-client/src/__tests__/dashboards.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import type { Connection, MessageBase } from 'home-assistant-js-websocket'
import { HaClient } from '../client.js'
import { HaApplyError, type ApplyDashboardOptions, type HaDashboardEntry } from '../dashboards.js'
import type { LovelaceConfig } from '@lovelacer/generator'

// Minimal LovelaceConfig stub. The HA client doesn't validate shape —
// it just forwards to HA.
const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
      sections: [],
    },
  ],
}

const lovelacerHome: HaDashboardEntry = {
  id: 'd1',
  url_path: 'lovelacer-home',
  title: 'Lovelacer — Home',
  icon: 'mdi:home-variant',
  show_in_sidebar: true,
  require_admin: false,
  mode: 'storage',
}

const otherDashboard: HaDashboardEntry = {
  id: 'd2',
  url_path: 'overview',
  title: 'Overview',
  icon: null,
  show_in_sidebar: true,
  require_admin: false,
  mode: 'storage',
}

function makeClient(): { client: HaClient; send: ReturnType<typeof vi.fn> } {
  const send = vi.fn()
  const fakeConnection = {
    sendMessagePromise: send,
    addEventListener: vi.fn(),
    connected: true,
    close: vi.fn(),
  } as unknown as Connection
  const client = new HaClient({
    url: 'ws://test',
    token: 'fake',
  })
  // Bypass connect() — inject the fake connection directly via a private
  // assignment for test purposes.
  ;(client as unknown as { connection: Connection }).connection = fakeConnection
  return { client, send }
}

describe('listDashboards', () => {
  it('forwards lovelace/dashboards/list and returns the array', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([lovelacerHome, otherDashboard])
    const result = await client.listDashboards()
    expect(send).toHaveBeenCalledWith({ type: 'lovelace/dashboards/list' })
    expect(result).toEqual([lovelacerHome, otherDashboard])
  })

  it('throws when not connected', async () => {
    const client = new HaClient({ url: 'ws://test', token: 'fake' })
    await expect(client.listDashboards()).rejects.toThrow(/not connected/)
  })
})

describe('applyDashboard — when dashboard missing', () => {
  it('sends list, then create, then save', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([otherDashboard]) // list (no lovelacer-home)
    send.mockResolvedValueOnce(null) // create
    send.mockResolvedValueOnce(null) // save

    const result = await client.applyDashboard(config)

    expect(send).toHaveBeenCalledTimes(3)
    expect(send.mock.calls[0]![0]).toEqual({ type: 'lovelace/dashboards/list' })
    expect(send.mock.calls[1]![0]).toEqual({
      type: 'lovelace/dashboards/create',
      url_path: 'lovelacer-home',
      title: 'Lovelacer — Home',
      icon: 'mdi:home-variant',
      show_in_sidebar: true,
      require_admin: false,
      mode: 'storage',
    })
    expect(send.mock.calls[2]![0]).toEqual({
      type: 'lovelace/config/save',
      url_path: 'lovelacer-home',
      config,
    })
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: true })
  })
})

describe('applyDashboard — when dashboard exists', () => {
  it('skips create, just saves', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([lovelacerHome]) // list (lovelacer-home present)
    send.mockResolvedValueOnce(null) // save

    const result = await client.applyDashboard(config)

    expect(send).toHaveBeenCalledTimes(2)
    expect(send.mock.calls[0]![0]).toEqual({ type: 'lovelace/dashboards/list' })
    expect(send.mock.calls[1]![0]).toEqual({
      type: 'lovelace/config/save',
      url_path: 'lovelacer-home',
      config,
    })
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: false })
  })
})

describe('applyDashboard — options', () => {
  it('uses defaults when options is undefined', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    await client.applyDashboard(config)

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('lovelacer-home')
    expect(createCall.title).toBe('Lovelacer — Home')
    expect(createCall.icon).toBe('mdi:home-variant')
    expect(createCall.show_in_sidebar).toBe(true)
    expect(createCall.require_admin).toBe(false)
    expect(createCall.mode).toBe('storage')
  })

  it('overrides defaults from options', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    const options: ApplyDashboardOptions = {
      urlPath: 'my-home',
      title: 'My Home',
      icon: 'mdi:home',
      showInSidebar: false,
      requireAdmin: true,
    }
    await client.applyDashboard(config, options)

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('my-home')
    expect(createCall.title).toBe('My Home')
    expect(createCall.icon).toBe('mdi:home')
    expect(createCall.show_in_sidebar).toBe(false)
    expect(createCall.require_admin).toBe(true)
  })

  it('partial options merge with defaults', async () => {
    const { client, send } = makeClient()
    send.mockResolvedValueOnce([])
    send.mockResolvedValueOnce(null)
    send.mockResolvedValueOnce(null)

    await client.applyDashboard(config, { urlPath: 'foo' })

    const createCall = send.mock.calls[1]![0] as MessageBase & Record<string, unknown>
    expect(createCall.url_path).toBe('foo')
    expect(createCall.title).toBe('Lovelacer — Home') // default
    expect(createCall.icon).toBe('mdi:home-variant') // default
  })
})

describe('applyDashboard — error handling', () => {
  it('list fails → HaApplyError with step "list" and no further calls', async () => {
    const { client, send } = makeClient()
    const cause = new Error('connection lost')
    send.mockRejectedValueOnce(cause)

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'list',
      cause,
    })
    expect(send).toHaveBeenCalledTimes(1)
  })

  it('create fails → HaApplyError with step "create" and save not called', async () => {
    const { client, send } = makeClient()
    const cause = new Error('permission denied')
    send.mockResolvedValueOnce([]) // list
    send.mockRejectedValueOnce(cause) // create

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'create',
      cause,
    })
    expect(send).toHaveBeenCalledTimes(2)
  })

  it('save fails → HaApplyError with step "save"', async () => {
    const { client, send } = makeClient()
    const cause = new Error('config invalid')
    send.mockResolvedValueOnce([lovelacerHome]) // list (exists)
    send.mockRejectedValueOnce(cause) // save

    await expect(client.applyDashboard(config)).rejects.toMatchObject({
      name: 'HaApplyError',
      step: 'save',
      cause,
    })
  })

  it('HaApplyError exposes step and cause as readonly fields', () => {
    const cause = new Error('boom')
    const err = new HaApplyError('save', 'failed to save', cause)
    expect(err.name).toBe('HaApplyError')
    expect(err.step).toBe('save')
    expect(err.cause).toBe(cause)
    expect(err.message).toBe('failed to save')
    expect(err).toBeInstanceOf(Error)
  })

  it('throws when not connected before any WS call', async () => {
    const client = new HaClient({ url: 'ws://test', token: 'fake' })
    await expect(client.applyDashboard(config)).rejects.toThrow(/not connected/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/ha-client/src/__tests__/dashboards.test.ts
```

Expected: FAIL — module not found for `../dashboards.js`.

- [ ] **Step 3: Implement `dashboards.ts`**

Create `packages/ha-client/src/dashboards.ts`:

```ts
/**
 * Types and errors for the storage-mode apply flow. The methods live on
 * `HaClient` (see client.ts) — this file holds the supporting surface so
 * client.ts stays focused on connection lifecycle.
 */

export interface ApplyDashboardOptions {
  /** Default 'lovelacer-home'. The HA `url_path` segment. */
  urlPath?: string
  /** Default 'Lovelacer — Home'. The dashboard title shown in the sidebar. */
  title?: string
  /** Default 'mdi:home-variant'. The sidebar icon. */
  icon?: string
  /** Default true. Whether to show the dashboard in HA's sidebar. */
  showInSidebar?: boolean
  /** Default false. Whether the dashboard requires admin to view. */
  requireAdmin?: boolean
}

export interface ApplyDashboardResult {
  urlPath: string
  /** True if the dashboard was freshly created; false if updated existing. */
  created: boolean
}

export interface HaDashboardEntry {
  id: string
  url_path: string
  title: string
  icon: string | null
  show_in_sidebar: boolean
  require_admin: boolean
  mode: 'storage' | 'yaml'
}

/**
 * Defaults applied when the caller omits the corresponding field from
 * `ApplyDashboardOptions`. Frozen to prevent accidental mutation; the
 * field-by-field merge in `applyDashboard` reads from this constant.
 */
export const DEFAULT_APPLY_OPTIONS = Object.freeze({
  urlPath: 'lovelacer-home',
  title: 'Lovelacer — Home',
  icon: 'mdi:home-variant',
  showInSidebar: true,
  requireAdmin: false,
} as const)

/**
 * Thrown when any of the three WS calls in `applyDashboard` fails. The
 * `step` field tells the caller which call failed so route handlers can
 * surface meaningful errors to the frontend.
 */
export class HaApplyError extends Error {
  readonly step: 'list' | 'create' | 'save'
  override readonly cause: unknown
  constructor(step: HaApplyError['step'], message: string, cause: unknown) {
    super(message)
    this.name = 'HaApplyError'
    this.step = step
    this.cause = cause
  }
}
```

- [ ] **Step 4: Add methods to `HaClient`**

Read `packages/ha-client/src/client.ts` first. Add the following imports near the top:

```ts
import type { LovelaceConfig } from '@lovelacer/generator'
import {
  DEFAULT_APPLY_OPTIONS,
  HaApplyError,
  type ApplyDashboardOptions,
  type ApplyDashboardResult,
  type HaDashboardEntry,
} from './dashboards.js'
```

Then append two new methods to the `HaClient` class, after `getFloorRegistry` and before the private `send` method:

```ts
async listDashboards(): Promise<HaDashboardEntry[]> {
  return this.send<HaDashboardEntry[]>({ type: 'lovelace/dashboards/list' })
}

async applyDashboard(
  config: LovelaceConfig,
  options?: ApplyDashboardOptions,
): Promise<ApplyDashboardResult> {
  const opts = { ...DEFAULT_APPLY_OPTIONS, ...options }

  let dashboards: HaDashboardEntry[]
  try {
    dashboards = await this.listDashboards()
  } catch (cause) {
    throw new HaApplyError('list', 'failed to list HA dashboards', cause)
  }

  const existing = dashboards.find((d) => d.url_path === opts.urlPath)
  if (existing === undefined) {
    try {
      await this.send({
        type: 'lovelace/dashboards/create',
        url_path: opts.urlPath,
        title: opts.title,
        icon: opts.icon,
        show_in_sidebar: opts.showInSidebar,
        require_admin: opts.requireAdmin,
        mode: 'storage',
      })
    } catch (cause) {
      throw new HaApplyError(
        'create',
        `failed to create dashboard ${opts.urlPath}`,
        cause,
      )
    }
  }

  try {
    await this.send({
      type: 'lovelace/config/save',
      url_path: opts.urlPath,
      config,
    })
  } catch (cause) {
    throw new HaApplyError(
      'save',
      `failed to save dashboard config for ${opts.urlPath}`,
      cause,
    )
  }

  return { urlPath: opts.urlPath, created: existing === undefined }
}
```

The `send` method's "not connected" guard already throws — the test asserts that. No change needed.

- [ ] **Step 5: Re-export from the package barrel**

Read `packages/ha-client/src/index.ts` first. The current line is:

```ts
export { HaClient, type HaClientOptions } from './client.js'
```

Replace it with:

```ts
export { HaClient, type HaClientOptions } from './client.js'
export {
  DEFAULT_APPLY_OPTIONS,
  HaApplyError,
  type ApplyDashboardOptions,
  type ApplyDashboardResult,
  type HaDashboardEntry,
} from './dashboards.js'
```

- [ ] **Step 6: Add `@lovelacer/generator` dep to ha-client**

Read `packages/ha-client/package.json`. Verify it has `"@lovelacer/generator": "workspace:*"` in dependencies. If not, add it (alphabetical with the other workspace deps). The new `dashboards.ts` import of `LovelaceConfig` requires this.

If the dep was added, run from the worktree root:

```bash
pnpm --dir <worktree> install
```

- [ ] **Step 7: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/ha-client/src/__tests__/dashboards.test.ts
```

Expected: PASS — about 13 tests.

- [ ] **Step 8: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 9: Commit**

```bash
git -C <worktree> add packages/ha-client/src/dashboards.ts \
        packages/ha-client/src/client.ts \
        packages/ha-client/src/index.ts \
        packages/ha-client/src/__tests__/dashboards.test.ts \
        packages/ha-client/package.json
git -C <worktree> commit -m "$(cat <<'EOF'
feat(ha-client): applyDashboard + listDashboards storage-mode apply

Three-call WS sequence: lovelace/dashboards/list → dashboards/create
(when missing) → config/save. Idempotent — re-runs update the existing
dashboard rather than creating duplicates. Throws HaApplyError({ step,
cause }) on first failure so callers can branch on which WS call broke.

Configurable via ApplyDashboardOptions (urlPath, title, icon,
showInSidebar, requireAdmin) with sensible defaults wrapped in a frozen
DEFAULT_APPLY_OPTIONS constant.

Tests use a fake Connection injected via a private assignment so the
WS protocol surface is exercised without real HA infrastructure. P1a-11
add-on packaging owns the real-HA smoke test.

P1a-8 layer 2 of 3 (ha-client). Server pipeline + routes next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Server pipeline (`runAnalyze` + `runPreview` + `runApply`) + tests

**Files:**

- Create: `packages/server/src/pipeline.ts`
- Create: `packages/server/src/__tests__/pipeline.test.ts`

The pipeline is a pure-composition layer: thin functions that route the analyzer + generator + ha-client outputs together. Routes wrap these functions.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/__tests__/pipeline.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError, type ApplyDashboardResult } from '@lovelacer/ha-client'
import type { LovelaceConfig } from '@lovelacer/generator'
import type {
  HaAreaRegistryEntry,
  HaDeviceRegistryEntry,
  HaEntityRegistryEntry,
  HaFloorRegistryEntry,
} from '@lovelacer/shared'
import { englishCluttered } from '../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../tests/fixtures/_builder/index.js'
import { runAnalyze, runApply, runPreview } from '../pipeline.js'

interface FakeHa {
  client: HaClient
  applyDashboard: ReturnType<typeof vi.fn>
  getEntityRegistry: ReturnType<typeof vi.fn>
  getDeviceRegistry: ReturnType<typeof vi.fn>
  getAreaRegistry: ReturnType<typeof vi.fn>
}

function makeFakeHa(): FakeHa {
  const ha = fixtureToHaRegistries(englishCluttered)
  const applyDashboard = vi.fn<[LovelaceConfig, unknown?], Promise<ApplyDashboardResult>>()
  const getEntityRegistry = vi.fn<[], Promise<HaEntityRegistryEntry[]>>(async () => ha.entities)
  const getDeviceRegistry = vi.fn<[], Promise<HaDeviceRegistryEntry[]>>(async () => ha.devices)
  const getAreaRegistry = vi.fn<[], Promise<HaAreaRegistryEntry[]>>(async () => ha.areas)
  const getFloorRegistry = vi.fn<[], Promise<HaFloorRegistryEntry[]>>(async () => [])

  const client = {
    isConnected: () => true,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry,
    applyDashboard,
  } as unknown as HaClient

  return { client, applyDashboard, getEntityRegistry, getDeviceRegistry, getAreaRegistry }
}

describe('runAnalyze', () => {
  it('returns rooms, misc, summary with consistent counts', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client)

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.summary.roomCount).toBe(result.rooms.length)
    expect(result.summary.miscCount).toBe(result.misc.length)
    expect(fake.getEntityRegistry).toHaveBeenCalledOnce()
    expect(fake.getDeviceRegistry).toHaveBeenCalledOnce()
    expect(fake.getAreaRegistry).toHaveBeenCalledOnce()
  })

  it('rooms are sorted alphabetically by displayName', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client)
    const names = result.rooms.map((r) => r.displayName)
    const sorted = [...names].sort((a, b) => a.localeCompare(b, 'en'))
    expect(names).toEqual(sorted)
  })

  it('rooms array does not contain the misc room', async () => {
    const fake = makeFakeHa()
    const result = await runAnalyze(fake.client)
    expect(result.rooms.every((r) => r.id !== 'misc')).toBe(true)
  })
})

describe('runPreview', () => {
  it('returns analyze output plus a config', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(fake.client)

    expect(result.summary.entityCount).toBeGreaterThan(0)
    expect(result.config.title).toBe('Lovelacer — Home')
    expect(result.config.views.length).toBeGreaterThan(0)
    expect(result.config.views[0]!.path).toBe('home')
  })

  it('rooms in config.views (after home) match alphabetical order', async () => {
    const fake = makeFakeHa()
    const result = await runPreview(fake.client)
    const titles = result.config.views.slice(1).map((v) => v.title)
    const sorted = [...titles].sort((a, b) => a.localeCompare(b, 'en'))
    expect(titles).toEqual(sorted)
  })
})

describe('runApply', () => {
  it('with body.config: applies that config and skips registry calls', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'custom',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'lovelacer-home', created: true })

    const result = await runApply(fake.client, { config })

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, undefined)
    expect(fake.getEntityRegistry).not.toHaveBeenCalled()
    expect(result).toEqual({ urlPath: 'lovelacer-home', created: true })
  })

  it('without body.config: re-runs preview and applies its config', async () => {
    const fake = makeFakeHa()
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: false,
    })

    const result = await runApply(fake.client, {})

    expect(fake.getEntityRegistry).toHaveBeenCalledOnce()
    expect(fake.applyDashboard).toHaveBeenCalledOnce()
    const passedConfig = fake.applyDashboard.mock.calls[0]![0]
    expect(passedConfig.title).toBe('Lovelacer — Home')
    expect(passedConfig.views[0]!.path).toBe('home')
    expect(result.urlPath).toBe('lovelacer-home')
  })

  it('forwards options to applyDashboard', async () => {
    const fake = makeFakeHa()
    const config: LovelaceConfig = {
      title: 'x',
      views: [
        {
          type: 'sections',
          title: 'Home',
          path: 'home',
          icon: 'mdi:home-variant',
          sections: [],
        },
      ],
    }
    fake.applyDashboard.mockResolvedValueOnce({ urlPath: 'foo', created: true })

    await runApply(fake.client, {
      config,
      options: { urlPath: 'foo', title: 'Foo' },
    })

    expect(fake.applyDashboard).toHaveBeenCalledWith(config, {
      urlPath: 'foo',
      title: 'Foo',
    })
  })

  it('propagates HaApplyError unchanged', async () => {
    const fake = makeFakeHa()
    const err = new HaApplyError('save', 'oops', new Error('boom'))
    fake.applyDashboard.mockRejectedValueOnce(err)

    await expect(
      runApply(fake.client, {
        config: {
          title: 'x',
          views: [
            {
              type: 'sections',
              title: 'Home',
              path: 'home',
              icon: 'mdi:home-variant',
              sections: [],
            },
          ],
        },
      }),
    ).rejects.toBe(err)
  })

  it('rejects malformed body.config (title not string)', async () => {
    const fake = makeFakeHa()
    const bad = { title: 123, views: [] } as unknown as LovelaceConfig
    await expect(runApply(fake.client, { config: bad })).rejects.toThrow(/invalid_config/)
    expect(fake.applyDashboard).not.toHaveBeenCalled()
  })

  it('rejects malformed body.config (views not array)', async () => {
    const fake = makeFakeHa()
    const bad = { title: 'x', views: {} } as unknown as LovelaceConfig
    await expect(runApply(fake.client, { config: bad })).rejects.toThrow(/invalid_config/)
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/pipeline.test.ts
```

Expected: FAIL — module not found for `../pipeline.js`.

- [ ] **Step 3: Implement `pipeline.ts`**

Create `packages/server/src/pipeline.ts`:

```ts
import { detect, groupByDomain, normalize, type RoomGrouping } from '@lovelacer/analyzer'
import {
  buildHomeView,
  buildLovelaceConfig,
  buildRoomViews,
  type LovelaceConfig,
} from '@lovelacer/generator'
import type { ApplyDashboardOptions, ApplyDashboardResult, HaClient } from '@lovelacer/ha-client'
import type {
  AnalyzedRoom,
  CanonicalRoomId,
  HaAreaRegistryEntry,
  NormalizedEntity,
  RoomAssignment,
} from '@lovelacer/shared'

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: { entityId: string; friendlyName: string; domain: string }[]
  summary: { entityCount: number; roomCount: number; miscCount: number }
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}

export interface ApplyInput {
  config?: LovelaceConfig
  options?: ApplyDashboardOptions
}

/**
 * Display names for the 14 canonical rooms. Used as fallback when a room
 * has no entities with `haAreaId` set (i.e., entities matched only via
 * name signals so we can't pull a localized area name).
 *
 * Mirrors the titles used in `packages/generator/src/room-view.ts`'s
 * `ROOM_DISPLAY` table. P1b-2 may DRY these up; for now the duplication
 * is small and self-contained.
 */
const CANONICAL_ROOM_NAMES: Record<CanonicalRoomId, string> = {
  kitchen: 'Kitchen',
  living_room: 'Living Room',
  bedroom: 'Bedroom',
  bathroom: 'Bathroom',
  office: 'Office',
  garage: 'Garage',
  garden: 'Garden',
  dining_room: 'Dining Room',
  laundry: 'Laundry',
  basement: 'Basement',
  attic: 'Attic',
  kids_room: "Kids' Room",
  guest_room: 'Guest Room',
  hallway: 'Hallway',
  misc: 'Other',
}

export async function runAnalyze(ha: HaClient): Promise<AnalyzeOutput> {
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])

  const entities = normalize({
    entities: entityRegistry,
    devices: deviceRegistry,
  })
  const assignments = detect({ entities, areas: areaRegistry })
  const groupings = groupByDomain({ assignments, entities })

  const entityById = new Map(entities.map((e) => [e.entityId, e]))

  const rooms: AnalyzedRoom[] = []
  const misc: AnalyzeOutput['misc'] = []

  for (const grouping of groupings) {
    const roomAssignments = assignments.filter((a) => a.roomId === grouping.roomId)
    if (grouping.roomId === 'misc') {
      for (const a of roomAssignments) {
        const e = entityById.get(a.entityId)
        if (e === undefined || e.isHidden || e.isDisabled) continue
        misc.push({
          entityId: e.entityId,
          friendlyName: e.friendlyName,
          domain: e.domain,
        })
      }
      continue
    }

    rooms.push(buildAnalyzedRoom(grouping, roomAssignments, entityById, areaRegistry))
  }

  rooms.sort((a, b) => a.displayName.localeCompare(b.displayName, 'en'))

  return {
    rooms,
    misc,
    summary: {
      entityCount: entities.length,
      roomCount: rooms.length,
      miscCount: misc.length,
    },
  }
}

function buildAnalyzedRoom(
  grouping: RoomGrouping,
  roomAssignments: RoomAssignment[],
  entityById: ReadonlyMap<string, NormalizedEntity>,
  areas: HaAreaRegistryEntry[],
): AnalyzedRoom {
  // Find the dominant haAreaId (the most common area_id among entities in
  // this room). If no entities have an area, fall back to canonical name.
  const areaCounts = new Map<string, number>()
  for (const a of roomAssignments) {
    const e = entityById.get(a.entityId)
    if (e?.haAreaId !== null && e?.haAreaId !== undefined) {
      areaCounts.set(e.haAreaId, (areaCounts.get(e.haAreaId) ?? 0) + 1)
    }
  }

  let haAreaId: string | null = null
  if (areaCounts.size > 0) {
    let topArea: string | null = null
    let topCount = 0
    for (const [areaId, count] of areaCounts) {
      if (count > topCount) {
        topArea = areaId
        topCount = count
      }
    }
    haAreaId = topArea
  }

  const displayName =
    haAreaId !== null
      ? (areas.find((a) => a.area_id === haAreaId)?.name ?? CANONICAL_ROOM_NAMES[grouping.roomId])
      : CANONICAL_ROOM_NAMES[grouping.roomId]

  const totalConfidence = roomAssignments.reduce((sum, a) => sum + a.confidence, 0)
  const averageConfidence =
    roomAssignments.length === 0 ? 0 : totalConfidence / roomAssignments.length

  return {
    id: grouping.roomId,
    haAreaId,
    displayName,
    entityCount: roomAssignments.length,
    averageConfidence,
    assignments: roomAssignments,
  }
}

export async function runPreview(ha: HaClient): Promise<PreviewOutput> {
  const analyze = await runAnalyze(ha)

  // We need the entities + groupings again. Re-fetch is cheap; alternative
  // is to thread them out of runAnalyze, but that bloats AnalyzeOutput.
  const [entityRegistry, deviceRegistry, areaRegistry] = await Promise.all([
    ha.getEntityRegistry(),
    ha.getDeviceRegistry(),
    ha.getAreaRegistry(),
  ])
  const entities = normalize({
    entities: entityRegistry,
    devices: deviceRegistry,
  })
  const assignments = detect({ entities, areas: areaRegistry })
  const groupings = groupByDomain({ assignments, entities })

  const home = buildHomeView({ entities })
  const rooms = buildRoomViews(groupings)
  const config = buildLovelaceConfig({ home, rooms })

  return { ...analyze, config }
}

export async function runApply(ha: HaClient, body: ApplyInput): Promise<ApplyDashboardResult> {
  if (body.config !== undefined) {
    if (typeof body.config.title !== 'string' || !Array.isArray(body.config.views)) {
      throw new Error('invalid_config: title must be string and views must be array')
    }
    return ha.applyDashboard(body.config, body.options)
  }

  const preview = await runPreview(ha)
  return ha.applyDashboard(preview.config, body.options)
}
```

- [ ] **Step 4: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/pipeline.test.ts
```

Expected: PASS — about 12 tests.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/server/src/pipeline.ts \
        packages/server/src/__tests__/pipeline.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(server): pipeline.ts — runAnalyze, runPreview, runApply

Composition layer that routes analyzer + generator + ha-client outputs
together. Routes wrap these functions thinly.

- runAnalyze: parallel registry fetch → normalize → detect →
  groupByDomain → AnalyzedRoom[] (alphabetical) + misc bucket + summary
- runPreview: runAnalyze + buildHomeView + buildRoomViews +
  buildLovelaceConfig
- runApply: hybrid — uses body.config if provided, else re-runs preview
  and applies its config. Validates body.config shape (title: string,
  views: array) before forwarding.

P1a-8 layer 3 of 3 (server pipeline). Routes next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: Server route plumbing + `/api/analyze` route + tests

**Files:**

- Create: `packages/server/src/app.ts` (extracted Fastify app builder)
- Create: `packages/server/src/routes/analyze.ts`
- Create: `packages/server/src/__tests__/routes/analyze.test.ts`
- Modify: `packages/server/src/main.ts`

Refactor `main.ts` to extract a `createApp(ha)` builder so route tests can inject a fake HaClient. Then implement `/api/analyze` as a Fastify plugin.

- [ ] **Step 1: Extract `createApp` from `main.ts`**

Read `packages/server/src/main.ts` first. Create `packages/server/src/app.ts`:

```ts
import Fastify, { type FastifyInstance } from 'fastify'
import cors from '@fastify/cors'
import sensible from '@fastify/sensible'
import type { HaClient } from '@lovelacer/ha-client'
import { analyzeRoute } from './routes/analyze.js'

export interface CreateAppOptions {
  ha: HaClient
  isDev?: boolean
  logLevel?: string
}

export async function createApp(opts: CreateAppOptions): Promise<FastifyInstance> {
  const app = Fastify({
    logger: {
      level: opts.logLevel ?? 'info',
      ...(opts.isDev === true && {
        transport: { target: 'pino-pretty', options: { colorize: true } },
      }),
    },
  })

  await app.register(cors, { origin: true })
  await app.register(sensible)

  // Health check — must be O(1). Polled by HA add-on supervisor and ingress
  // healthchecks.
  app.get('/api/health', async () => ({
    ok: true,
    version: '0.0.0',
    ha: { connected: opts.ha.isConnected() },
  }))

  await app.register(analyzeRoute, { ha: opts.ha })

  return app
}
```

- [ ] **Step 2: Update `main.ts` to use the builder**

Replace the contents of `packages/server/src/main.ts` with:

```ts
import { HaClient } from '@lovelacer/ha-client'
import { config } from './config.js'
import { createApp } from './app.js'

async function main() {
  // Require an explicit `NODE_ENV=development` to enable pino-pretty, since
  // pino-pretty is a devDependency and would crash a production install
  // (e.g., HA add-on container) where it isn't bundled.
  const isDev = process.env.NODE_ENV === 'development'

  const ha = new HaClient({
    url: config.ha.url,
    token: config.ha.token,
  })

  const app = await createApp({ ha, isDev, logLevel: config.logLevel })

  // Connect to HA in background — health endpoint returns status either way.
  ha.connect().catch((err) => {
    app.log.error({ err }, 'failed to connect to Home Assistant on startup')
  })

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    await ha.disconnect()
    await app.close()
    process.exit(0)
  }
  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  await app.listen({ port: config.port, host: '0.0.0.0' })
}

main().catch((err) => {
  console.error('fatal startup error:', err)
  process.exit(1)
})
```

- [ ] **Step 3: Write the failing tests**

Create `packages/server/src/__tests__/routes/analyze.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

describe('POST /api/analyze', () => {
  it('returns 200 with rooms, misc, summary when HA connected', async () => {
    const ha = makeHa(true)
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        rooms: unknown[]
        misc: unknown[]
        summary: { entityCount: number; roomCount: number; miscCount: number }
      }
      expect(body.summary.entityCount).toBeGreaterThan(0)
      expect(body.rooms.length).toBe(body.summary.roomCount)
      expect(body.misc.length).toBe(body.summary.miscCount)
    } finally {
      await app.close()
    }
  })

  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const ha = makeHa(false)
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 500 analyze_failed when registry fetch throws', async () => {
    const ha = {
      isConnected: () => true,
      getEntityRegistry: vi.fn(async () => {
        throw new Error('boom')
      }),
      getDeviceRegistry: vi.fn(async () => []),
      getAreaRegistry: vi.fn(async () => []),
    } as unknown as HaClient
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(500)
      expect(res.json()).toMatchObject({ error: 'analyze_failed' })
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 4: Implement `analyze.ts`**

Create `packages/server/src/routes/analyze.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { runAnalyze } from '../pipeline.js'

export interface AnalyzeRouteOptions {
  ha: HaClient
}

/**
 * POST /api/analyze — pulls registries from HA, runs the full analyzer
 * pipeline (normalize → detect → groupByDomain), and returns a summary
 * with rooms, misc bucket, and counts.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 analyze_failed: registry fetch or analysis threw
 */
export const analyzeRoute: FastifyPluginAsync<AnalyzeRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/analyze', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const result = await runAnalyze(opts.ha)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'analyze failed')
      return reply.code(500).send({ error: 'analyze_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/analyze.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green. The dropped `notImplemented()` placeholders for `/api/preview` and `/api/apply` won't be re-added by main.ts (the next two tasks add them via `createApp`'s register chain).

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/server/src/app.ts \
        packages/server/src/main.ts \
        packages/server/src/routes/analyze.ts \
        packages/server/src/__tests__/routes/analyze.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(server): /api/analyze route + createApp builder for tests

Extract the Fastify app construction into createApp(opts) so route
tests can inject a fake HaClient via app.inject(). main.ts becomes a
thin wrapper that wires the real HaClient and process lifecycle.

/api/analyze returns rooms (alphabetical) + misc bucket + summary on
200. 503 ha_unavailable when disconnected; 500 analyze_failed on
internal error.

P1a-8 layer 4a of 4 (analyze route). Preview + apply routes next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: `/api/preview` route + tests

**Files:**

- Create: `packages/server/src/routes/preview.ts`
- Create: `packages/server/src/__tests__/routes/preview.test.ts`
- Modify: `packages/server/src/app.ts`

Add the preview route. Same shape as analyze, plus the generated `LovelaceConfig`.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/__tests__/routes/preview.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'

function makeHa(connected = true): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => connected,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

describe('POST /api/preview', () => {
  it('returns 200 with rooms + config when HA connected', async () => {
    const ha = makeHa(true)
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(200)
      const body = res.json() as {
        rooms: unknown[]
        config: { title: string; views: { path: string }[] }
        summary: { entityCount: number }
      }
      expect(body.summary.entityCount).toBeGreaterThan(0)
      expect(body.config.title).toBe('Lovelacer — Home')
      expect(body.config.views[0]!.path).toBe('home')
    } finally {
      await app.close()
    }
  })

  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const ha = makeHa(false)
    const app = await createApp({ ha, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/preview.test.ts
```

Expected: FAIL — module not found for `../routes/preview.js` (or 404 on `/api/preview` if app.ts hasn't been updated yet).

- [ ] **Step 3: Implement `preview.ts`**

Create `packages/server/src/routes/preview.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { runPreview } from '../pipeline.js'

export interface PreviewRouteOptions {
  ha: HaClient
}

/**
 * POST /api/preview — runs analyze + builds the LovelaceConfig. Returns
 * rooms, misc, summary, plus the generated config. Frontend can show
 * a preview before applying.
 *
 * Errors:
 * - 503 ha_unavailable: HaClient not connected
 * - 500 preview_failed: pipeline threw
 */
export const previewRoute: FastifyPluginAsync<PreviewRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post('/api/preview', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const result = await runPreview(opts.ha)
      return reply.code(200).send(result)
    } catch (err) {
      req.log.error({ err }, 'preview failed')
      return reply.code(500).send({ error: 'preview_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Wire `previewRoute` into `app.ts`**

Read `packages/server/src/app.ts` first. Append to the imports:

```ts
import { previewRoute } from './routes/preview.js'
```

Append the registration after the analyzeRoute registration (just before `return app`):

```ts
await app.register(previewRoute, { ha: opts.ha })
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/preview.test.ts
```

Expected: PASS — 2 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/server/src/routes/preview.ts \
        packages/server/src/app.ts \
        packages/server/src/__tests__/routes/preview.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(server): /api/preview route

Returns the analyze output plus the generated LovelaceConfig. Lets the
frontend show a preview (or pass the config back into /api/apply for
stateless apply).

P1a-8 layer 4b of 4 (preview route). Apply route next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `/api/apply` route + tests + main.ts smoke check

**Files:**

- Create: `packages/server/src/routes/apply.ts`
- Create: `packages/server/src/__tests__/routes/apply.test.ts`
- Modify: `packages/server/src/app.ts`

Add the apply route. Hybrid mode (optional config body), config validation, `HaApplyError` → 502 mapping.

- [ ] **Step 1: Write the failing tests**

Create `packages/server/src/__tests__/routes/apply.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import type { LovelaceConfig } from '@lovelacer/generator'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'

interface FakeHa {
  client: HaClient
  applyDashboard: ReturnType<typeof vi.fn>
  getEntityRegistry: ReturnType<typeof vi.fn>
}

function makeHa(connected = true): FakeHa {
  const ha = fixtureToHaRegistries(englishCluttered)
  const applyDashboard = vi.fn()
  const getEntityRegistry = vi.fn(async () => ha.entities)
  const getDeviceRegistry = vi.fn(async () => ha.devices)
  const getAreaRegistry = vi.fn(async () => ha.areas)
  const client = {
    isConnected: () => connected,
    getEntityRegistry,
    getDeviceRegistry,
    getAreaRegistry,
    getFloorRegistry: vi.fn(async () => []),
    applyDashboard,
  } as unknown as HaClient
  return { client, applyDashboard, getEntityRegistry }
}

const validConfig: LovelaceConfig = {
  title: 'Custom',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
      sections: [],
    },
  ],
}

describe('POST /api/apply — happy paths', () => {
  it('with no body: re-runs preview and applies', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: false,
    })
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/apply' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({
        ok: true,
        urlPath: 'lovelacer-home',
        created: false,
      })
      expect(fake.getEntityRegistry).toHaveBeenCalled()
      expect(fake.applyDashboard).toHaveBeenCalledOnce()
    } finally {
      await app.close()
    }
  })

  it('with body.config: applies that config without re-running preview', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'lovelacer-home',
      created: true,
    })
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toMatchObject({ ok: true, created: true })
      expect(fake.getEntityRegistry).not.toHaveBeenCalled()
      expect(fake.applyDashboard).toHaveBeenCalledWith(validConfig, undefined)
    } finally {
      await app.close()
    }
  })

  it('with body.options: forwards options to applyDashboard', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockResolvedValueOnce({
      urlPath: 'foo',
      created: true,
    })
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig, options: { urlPath: 'foo' } },
      })
      expect(res.statusCode).toBe(200)
      expect(fake.applyDashboard).toHaveBeenCalledWith(validConfig, { urlPath: 'foo' })
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/apply — error paths', () => {
  it('returns 503 ha_unavailable when HA disconnected', async () => {
    const fake = makeHa(false)
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/apply' })
      expect(res.statusCode).toBe(503)
      expect(res.json()).toMatchObject({ error: 'ha_unavailable' })
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_config when body.config.title is not a string', async () => {
    const fake = makeHa(true)
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 123, views: [] } },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_config' })
      expect(fake.applyDashboard).not.toHaveBeenCalled()
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_config when body.config.views is not an array', async () => {
    const fake = makeHa(true)
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 'x', views: {} } },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_config' })
    } finally {
      await app.close()
    }
  })

  it('returns 502 ha_apply_failed with step when HaApplyError thrown', async () => {
    const fake = makeHa(true)
    fake.applyDashboard.mockRejectedValueOnce(
      new HaApplyError('save', 'config invalid', new Error('cause')),
    )
    const app = await createApp({ ha: fake.client, logLevel: 'silent' })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: validConfig },
      })
      expect(res.statusCode).toBe(502)
      expect(res.json()).toMatchObject({
        error: 'ha_apply_failed',
        step: 'save',
      })
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/apply.test.ts
```

Expected: FAIL — module not found or 404.

- [ ] **Step 3: Implement `apply.ts`**

Create `packages/server/src/routes/apply.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import type { HaClient } from '@lovelacer/ha-client'
import { HaApplyError } from '@lovelacer/ha-client'
import { runApply, type ApplyInput } from '../pipeline.js'

export interface ApplyRouteOptions {
  ha: HaClient
}

/**
 * POST /api/apply — pushes a Lovelace dashboard to HA via storage-mode WS.
 *
 * Hybrid mode: accepts an optional `config` body. If present, that config
 * is pushed directly. If absent, the server re-runs preview internally
 * and pushes its config.
 *
 * Errors:
 * - 400 invalid_config: body.config provided but malformed (non-string
 *   title or non-array views)
 * - 502 ha_apply_failed: HaApplyError thrown by applyDashboard
 *   (response includes `step: 'list' | 'create' | 'save'`)
 * - 503 ha_unavailable: HaClient not connected
 * - 500: anything else
 */
export const applyRoute: FastifyPluginAsync<ApplyRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.post<{ Body: ApplyInput }>('/api/apply', async (req, reply) => {
    if (!opts.ha.isConnected()) {
      return reply
        .code(503)
        .send({ error: 'ha_unavailable', message: 'Home Assistant connection not ready' })
    }
    try {
      const body = (req.body ?? {}) as ApplyInput
      const result = await runApply(opts.ha, body)
      return reply.code(200).send({ ok: true, ...result })
    } catch (err) {
      if (err instanceof HaApplyError) {
        req.log.error({ err, step: err.step }, 'ha apply failed')
        return reply.code(502).send({
          error: 'ha_apply_failed',
          step: err.step,
          message: err.message,
        })
      }
      if (err instanceof Error && err.message.startsWith('invalid_config')) {
        return reply.code(400).send({
          error: 'invalid_config',
          message: err.message,
        })
      }
      req.log.error({ err }, 'apply failed')
      return reply.code(500).send({ error: 'apply_failed', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Wire `applyRoute` into `app.ts`**

Read `packages/server/src/app.ts` first. Append to the imports:

```ts
import { applyRoute } from './routes/apply.js'
```

Append the registration after the previewRoute registration (just before `return app`):

```ts
await app.register(applyRoute, { ha: opts.ha })
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/server/src/__tests__/routes/apply.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Run the full test suite**

```bash
pnpm --dir <worktree> -r test
```

All tests pass. Generator + ha-client + server + analyzer + root all green.

- [ ] **Step 7: Verify the full build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green. If `format:check` fails, run `pnpm --dir <worktree> format` and stage the result.

- [ ] **Step 8: Smoke-check `main.ts`**

```bash
pnpm --dir <worktree> --filter @lovelacer/server build
```

Build succeeds (TypeScript compiles `app.ts`, `main.ts`, all routes). No runtime test needed — that's P1a-11's job.

- [ ] **Step 9: Commit**

```bash
git -C <worktree> add packages/server/src/routes/apply.ts \
        packages/server/src/app.ts \
        packages/server/src/__tests__/routes/apply.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(server): /api/apply route

Hybrid mode: accepts optional body.config (pushes that directly) or
re-runs preview internally and pushes its config. Maps HaApplyError to
502 ha_apply_failed { step }; malformed body.config → 400 invalid_config.

Closes the P1a-8 implementation. Full pipeline now wired:
/api/analyze → /api/preview → /api/apply.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-8 Acceptance Confirmation

- [ ] `buildLovelaceConfig`, `LovelaceConfig`, `BuildLovelaceConfigInput` exported from `@lovelacer/generator`.
- [ ] `applyDashboard`, `listDashboards`, `ApplyDashboardOptions`, `ApplyDashboardResult`, `HaDashboardEntry`, `HaApplyError`, `DEFAULT_APPLY_OPTIONS` exported from `@lovelacer/ha-client`.
- [ ] `/api/analyze`, `/api/preview`, `/api/apply` routes wired and returning the documented shapes.
- [ ] All ~40 unit tests passing (~9 generator unit, ~6 generator fixture, ~13 ha-client, ~12 pipeline, ~3+2+6 routes).
- [ ] Fixture snapshot tests passing for both `english-cluttered` and `czech-tidy`.
- [ ] `pnpm typecheck`, `pnpm test`, `pnpm format:check`, `pnpm lint` clean.
- [ ] No real-HA test infrastructure introduced (P1a-11 owns that).
