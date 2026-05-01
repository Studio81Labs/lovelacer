# P1a-10 Frontend Review/Preview/Apply Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Ship the single-page Vue 3 + Pinia + Tailwind 4 flow inside `@lovelacer/web` that drives the Phase 1a alpha demo: Analyze → see rooms with confidence summaries → Apply → dashboard appears in HA. Two-call flow (`/api/preview` + `/api/apply` with cached config), two Pinia stores, Iconify pill preview, auto-reset 5s after success.

**Architecture:** API layer (`api/client.ts` + `api/types.ts`) is the only place `fetch()` is called; stores and components stay testable without mocking `fetch`. Two decoupled Pinia stores (`analyzeStore` for the preview call, `applyStore` for the apply call) — components wire them together at click time. Six new components (HealthBar, AnalyzeButton, RoomList, MiscBucket, DashboardPreview, ApplyBar) compose in `App.vue` with `v-if` sections that fill in as state advances. Bundled MDI icon set via `@iconify-json/mdi` so the SPA works offline without an Iconify CDN dependency.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), Vue 3 (`<script setup lang="ts">`), Pinia (setup-style stores), Tailwind 4, Vite, Vitest + `@vue/test-utils` + `happy-dom`, `@iconify/vue` + `@iconify-json/mdi`.

**Spec reference:** [`docs/superpowers/specs/2026-05-01-p1a-10-frontend-flow-design.md`](../specs/2026-05-01-p1a-10-frontend-flow-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source (`./client.ts` is imported as `'./client.js'`).
- Type-only imports use `import type { … } from '…'` (verbatimModuleSyntax).
- Tests use `import { describe, it, expect, vi, beforeEach } from 'vitest'`.
- Vue SFCs use `<script setup lang="ts">` with `defineProps<{...}>()` for typed props.
- Tailwind classes use the existing `brand-*` (oklch-based brand orange) and `stone-*` palettes. `green-*`, `amber-*`, `red-*` for status semantics.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- If husky's lint-staged or `pnpm format:check` reports drift, run `pnpm --dir <worktree> format`, re-stage, and retry — recurring quirk in this repo.

---

## Task 1: Workspace setup — devDeps + vitest config + Iconify bundle

**Files:**
- Modify: `packages/web/package.json`
- Modify: `packages/web/src/main.ts`
- Create: `packages/web/vitest.config.ts`

Install the test runtime + Iconify, register the bundled MDI icon set at app startup so the SPA works offline (no CDN runtime dep), and add a local vitest config so the package's tests are picked up by `pnpm -r test`. Per the root `vitest.config.ts` comment: workspace packages with their own tests MUST ship a local vitest config or their tests are silently skipped.

- [ ] **Step 1: Add deps to package.json**

Read `packages/web/package.json` first. Replace the dependencies/devDependencies blocks so the file becomes:

```json
{
  "name": "@lovelacer/web",
  "version": "0.0.0",
  "private": true,
  "type": "module",
  "scripts": {
    "build": "vite build",
    "dev": "vite",
    "preview": "vite preview",
    "test": "vitest run --passWithNoTests",
    "test:watch": "vitest",
    "typecheck": "vue-tsc --noEmit"
  },
  "dependencies": {
    "@iconify-json/mdi": "^1.2.1",
    "@iconify/vue": "^4.1.2",
    "pinia": "^2.2.4",
    "vue": "^3.5.10"
  },
  "devDependencies": {
    "@tailwindcss/vite": "^4.0.0-beta.4",
    "@vitejs/plugin-vue": "^5.1.4",
    "@vue/test-utils": "^2.4.6",
    "happy-dom": "^15.7.4",
    "tailwindcss": "^4.0.0-beta.4",
    "vite": "^5.4.8",
    "vue-tsc": "^2.1.6"
  }
}
```

- [ ] **Step 2: Create vitest.config.ts**

Create `packages/web/vitest.config.ts`:

```ts
import { defineConfig } from 'vitest/config'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [vue()],
  test: {
    globals: false,
    environment: 'happy-dom',
    coverage: {
      provider: 'v8',
      reporter: ['text', 'html'],
      exclude: ['**/node_modules/**', '**/dist/**', '**/*.config.*'],
    },
  },
})
```

- [ ] **Step 3: Register the bundled MDI icon set in `main.ts`**

Read `packages/web/src/main.ts` first (currently 7 lines: createApp, createPinia, mount). Replace it with:

```ts
import { createApp } from 'vue'
import { createPinia } from 'pinia'
import { addCollection } from '@iconify/vue'
import mdiIcons from '@iconify-json/mdi/icons.json'
import App from './App.vue'
import './styles.css'

// Register the MDI icon set up front so <Icon icon="mdi:..."> resolves
// from the bundled JSON at runtime instead of fetching from
// api.iconify.design (which would fail in offline HA installs).
addCollection(mdiIcons)

const app = createApp(App)
app.use(createPinia())
app.mount('#app')
```

Vite's static-import + tree-shaking ensure the JSON only ships in the browser bundle, not in test runs.

- [ ] **Step 4: Install + verify**

```bash
pnpm --dir <worktree> install
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> --filter @lovelacer/web build
```

All four pass. The web package's test run reports "No test files found, exiting with code 0" — that's the `--passWithNoTests` flag at work; tests land in later tasks. The build smoke-tests that the bundled MDI JSON imports correctly.

- [ ] **Step 5: Commit**

```bash
git -C <worktree> add packages/web/package.json \
        packages/web/src/main.ts \
        packages/web/vitest.config.ts \
        pnpm-lock.yaml
git -C <worktree> commit -m "$(cat <<'EOF'
chore(web): add Iconify + test runtime deps; bundle MDI icon set

Adds @iconify/vue + @iconify-json/mdi, @vue/test-utils, and happy-dom
(fast DOM-in-Node, faster than jsdom). main.ts now registers the
bundled MDI icon set at app startup via addCollection() so the SPA
works offline without a CDN runtime dep on api.iconify.design.

Plus a local vitest.config.ts so the web package's tests get picked up
by pnpm -r test (per the root config's "must ship local" rule).

P1a-10 layer 0 of 7 (workspace setup).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: API types + client + tests

**Files:**
- Create: `packages/web/src/api/types.ts`
- Create: `packages/web/src/api/client.ts`
- Create: `packages/web/src/__tests__/api/client.test.ts`

The only place in the frontend that calls `fetch()`. Stores and components import from here and stay testable via `vi.mock('../api/client.js')`. Types mirror the server's pipeline output (defined locally rather than imported from `@lovelacer/server` — that would drag Fastify deps into the browser bundle).

- [ ] **Step 1: Write the failing tests**

Create `packages/web/src/__tests__/api/client.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { postApply, postPreview } from '../../api/client.js'
import type { ApiError, LovelaceConfig, PreviewOutput } from '../../api/types.js'

const mockPreviewResponse: PreviewOutput = {
  rooms: [],
  misc: [],
  summary: { entityCount: 0, roomCount: 0, miscCount: 0 },
  config: { title: 'Lovelacer — Home', views: [] },
}

const mockConfig: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [],
}

describe('postPreview', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve(mockPreviewResponse),
    } as unknown as Response)

    const result = await postPreview()
    expect(result).toEqual(mockPreviewResponse)
    expect(globalThis.fetch).toHaveBeenCalledWith('api/preview', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
    })
  })

  it('throws ApiError when server returns 503 with structured body', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 503,
      json: () =>
        Promise.resolve({
          error: 'ha_unavailable',
          message: 'Home Assistant connection not ready',
        }),
    } as unknown as Response)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'ha_unavailable',
      message: 'Home Assistant connection not ready',
    } satisfies ApiError)
  })

  it('throws network ApiError when fetch rejects', async () => {
    const cause = new Error('connection refused')
    globalThis.fetch = vi.fn().mockRejectedValueOnce(cause)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'network',
    })
  })

  it('throws network ApiError when response is non-JSON 500', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 500,
      json: () => Promise.reject(new Error('not json')),
    } as unknown as Response)

    await expect(postPreview()).rejects.toMatchObject({
      error: 'network',
      message: 'HTTP 500',
    })
  })
})

describe('postApply', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends config in body and returns parsed result on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () =>
        Promise.resolve({ ok: true, urlPath: 'lovelacer-home', created: true }),
    } as unknown as Response)

    const result = await postApply({ config: mockConfig })
    expect(result).toEqual({ ok: true, urlPath: 'lovelacer-home', created: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/apply', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ config: mockConfig }),
    })
  })

  it('throws ApiError with step preserved on 502 ha_apply_failed', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 502,
      json: () =>
        Promise.resolve({
          error: 'ha_apply_failed',
          step: 'save',
          message: 'config invalid',
        }),
    } as unknown as Response)

    await expect(postApply({ config: mockConfig })).rejects.toMatchObject({
      error: 'ha_apply_failed',
      step: 'save',
      message: 'config invalid',
    })
  })
})
```

- [ ] **Step 2: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/api/client.test.ts
```

Expected: FAIL — module not found for `../../api/client.js`.

- [ ] **Step 3: Implement `api/types.ts`**

Create `packages/web/src/api/types.ts`:

```ts
/**
 * API surface mirroring the server's pipeline output. Defined locally
 * (not imported from `@lovelacer/server`) so the web package doesn't
 * drag Fastify's deps into the browser bundle.
 *
 * P1b extracts these into a shared `@lovelacer/api-types` package.
 * For now, server-side snapshot tests catch any shape change here.
 */

export interface DetectionSignal {
  source: string
  weight: number
  matchedValue?: string
}

export interface RoomAssignment {
  entityId: string
  roomId: string
  confidence: number
  signals: DetectionSignal[]
}

export interface AnalyzedRoom {
  id: string
  haAreaId: string | null
  displayName: string
  entityCount: number
  averageConfidence: number
  assignments: RoomAssignment[]
}

export interface MiscEntity {
  entityId: string
  friendlyName: string
  domain: string
}

export interface PreviewSummary {
  entityCount: number
  roomCount: number
  miscCount: number
}

export interface LovelaceView {
  type: string
  title: string
  path: string
  icon: string
  sections?: unknown[]
}

export interface LovelaceConfig {
  title: string
  views: LovelaceView[]
}

export interface AnalyzeOutput {
  rooms: AnalyzedRoom[]
  misc: MiscEntity[]
  summary: PreviewSummary
}

export interface PreviewOutput extends AnalyzeOutput {
  config: LovelaceConfig
}

export interface ApplyResult {
  ok: true
  urlPath: string
  created: boolean
}

/**
 * The error envelope every non-2xx response body conforms to. `step` is
 * present only when `error === 'ha_apply_failed'`. `'network'` is a
 * client-side signal that fetch itself rejected or the response wasn't
 * parseable JSON — never sent by the server.
 */
export interface ApiError {
  error:
    | 'ha_unavailable'
    | 'analyze_failed'
    | 'preview_failed'
    | 'invalid_config'
    | 'ha_apply_failed'
    | 'apply_failed'
    | 'network'
  step?: 'list' | 'create' | 'save'
  message: string
}
```

- [ ] **Step 4: Implement `api/client.ts`**

Create `packages/web/src/api/client.ts`:

```ts
import type {
  AnalyzeOutput,
  ApiError,
  ApplyResult,
  LovelaceConfig,
  PreviewOutput,
} from './types.js'

/**
 * Wraps a `fetch()` to a backend route in the standard error envelope.
 * URL is document-relative (no leading slash) so the request stays inside
 * the add-on path under HA Supervisor ingress (`/api/hassio_ingress/<token>/`).
 * Vite's dev proxy resolves the same path to the backend at :3000.
 */
async function postJson<T>(path: string, body?: unknown): Promise<T> {
  let res: Response
  try {
    res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      ...(body !== undefined && { body: JSON.stringify(body) }),
    })
  } catch (cause) {
    throw {
      error: 'network',
      message: cause instanceof Error ? cause.message : String(cause),
    } satisfies ApiError
  }

  if (!res.ok) {
    const parsed = await res.json().catch(() => null)
    if (parsed !== null && typeof parsed === 'object' && 'error' in parsed) {
      throw parsed as ApiError
    }
    throw {
      error: 'network',
      message: `HTTP ${res.status}`,
    } satisfies ApiError
  }

  return res.json() as Promise<T>
}

export function postAnalyze(): Promise<AnalyzeOutput> {
  return postJson<AnalyzeOutput>('api/analyze')
}

export function postPreview(): Promise<PreviewOutput> {
  return postJson<PreviewOutput>('api/preview')
}

export function postApply(body: { config: LovelaceConfig }): Promise<ApplyResult> {
  return postJson<ApplyResult>('api/apply', body)
}
```

- [ ] **Step 5: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/api/client.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/web/src/api/types.ts \
        packages/web/src/api/client.ts \
        packages/web/src/__tests__/api/client.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): API types + client wrapping fetch with structured ApiError

Three thin wrappers — postAnalyze, postPreview, postApply — over a
shared postJson() helper that normalizes server errors into the
ApiError envelope and surfaces network failures as { error: 'network' }.
URL is document-relative so the add-on ingress prefix and Vite dev
proxy both resolve correctly.

Types mirror the server's pipeline output. Defined locally rather than
imported from @lovelacer/server to keep Fastify's deps out of the
browser bundle. P1b extracts to @lovelacer/api-types.

P1a-10 layer 1 of 7 (API client).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Pinia stores (analyze + apply) + tests

**Files:**
- Create: `packages/web/src/stores/analyze.ts`
- Create: `packages/web/src/stores/apply.ts`
- Create: `packages/web/src/__tests__/stores/analyze.test.ts`
- Create: `packages/web/src/__tests__/stores/apply.test.ts`

Two decoupled Pinia setup-style stores. `applyStore` doesn't import `analyzeStore` — the component layer wires them.

- [ ] **Step 1: Write the failing tests for analyze store**

Create `packages/web/src/__tests__/stores/analyze.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useAnalyzeStore } from '../../stores/analyze.js'
import type { ApiError, PreviewOutput } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  postPreview: vi.fn(),
}))

const { postPreview } = await import('../../api/client.js')

const mockPreview: PreviewOutput = {
  rooms: [
    {
      id: 'kitchen',
      haAreaId: 'kitchen',
      displayName: 'Kitchen',
      entityCount: 12,
      averageConfidence: 0.92,
      assignments: [],
    },
  ],
  misc: [],
  summary: { entityCount: 12, roomCount: 1, miscCount: 0 },
  config: {
    title: 'Lovelacer — Home',
    views: [
      {
        type: 'sections',
        title: 'Home',
        path: 'home',
        icon: 'mdi:home-variant',
      },
    ],
  },
}

describe('useAnalyzeStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes idle', () => {
    const store = useAnalyzeStore()
    expect(store.phase).toBe('idle')
    expect(store.preview).toBeNull()
    expect(store.error).toBeNull()
  })

  it('happy path: loading → ready, populates preview', async () => {
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()

    const promise = store.analyze()
    expect(store.phase).toBe('loading')
    await promise

    expect(store.phase).toBe('ready')
    expect(store.preview).toEqual(mockPreview)
    expect(store.error).toBeNull()
  })

  it('error path: loading → error, leaves preview null', async () => {
    const apiErr: ApiError = { error: 'ha_unavailable', message: 'down' }
    vi.mocked(postPreview).mockRejectedValueOnce(apiErr)
    const store = useAnalyzeStore()

    await store.analyze()

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.preview).toBeNull()
  })

  it('reset() returns to idle and clears all fields', async () => {
    vi.mocked(postPreview).mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()
    await store.analyze()

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.preview).toBeNull()
    expect(store.error).toBeNull()
  })

  it('re-running analyze() after error clears prior error before fetching', async () => {
    vi.mocked(postPreview)
      .mockRejectedValueOnce({ error: 'ha_unavailable', message: 'first' })
      .mockResolvedValueOnce(mockPreview)
    const store = useAnalyzeStore()

    await store.analyze()
    expect(store.error).not.toBeNull()

    const promise = store.analyze()
    expect(store.error).toBeNull() // cleared eagerly when phase flips to loading
    await promise

    expect(store.phase).toBe('ready')
    expect(store.preview).toEqual(mockPreview)
  })
})
```

- [ ] **Step 2: Write the failing tests for apply store**

Create `packages/web/src/__tests__/stores/apply.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useApplyStore } from '../../stores/apply.js'
import type { ApiError, ApplyResult, LovelaceConfig } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  postApply: vi.fn(),
}))

const { postApply } = await import('../../api/client.js')

const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    {
      type: 'sections',
      title: 'Home',
      path: 'home',
      icon: 'mdi:home-variant',
    },
  ],
}

const mockResult: ApplyResult = {
  ok: true,
  urlPath: 'lovelacer-home',
  created: true,
}

describe('useApplyStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.clearAllMocks()
  })

  it('initializes idle', () => {
    const store = useApplyStore()
    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })

  it('happy path: applying → success, populates result', async () => {
    vi.mocked(postApply).mockResolvedValueOnce(mockResult)
    const store = useApplyStore()

    const promise = store.apply(config)
    expect(store.phase).toBe('applying')
    await promise

    expect(store.phase).toBe('success')
    expect(store.result).toEqual(mockResult)
    expect(vi.mocked(postApply)).toHaveBeenCalledWith({ config })
  })

  it('502 ha_apply_failed path: error preserves step', async () => {
    const apiErr: ApiError = {
      error: 'ha_apply_failed',
      step: 'save',
      message: 'failed at save',
    }
    vi.mocked(postApply).mockRejectedValueOnce(apiErr)
    const store = useApplyStore()

    await store.apply(config)

    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiErr)
    expect(store.error?.step).toBe('save')
    expect(store.result).toBeNull()
  })

  it('400 invalid_config path: error preserved for UI', async () => {
    const apiErr: ApiError = { error: 'invalid_config', message: 'bad title' }
    vi.mocked(postApply).mockRejectedValueOnce(apiErr)
    const store = useApplyStore()

    await store.apply(config)

    expect(store.phase).toBe('error')
    expect(store.error?.error).toBe('invalid_config')
  })

  it('reset() clears all fields', async () => {
    vi.mocked(postApply).mockResolvedValueOnce(mockResult)
    const store = useApplyStore()
    await store.apply(config)

    store.reset()

    expect(store.phase).toBe('idle')
    expect(store.result).toBeNull()
    expect(store.error).toBeNull()
  })
})
```

- [ ] **Step 3: Run the tests to verify they fail**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/stores/
```

Expected: FAIL — modules not found for `../../stores/analyze.js` and `../../stores/apply.js`.

- [ ] **Step 4: Implement `stores/analyze.ts`**

Create `packages/web/src/stores/analyze.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postPreview } from '../api/client.js'
import type { ApiError, PreviewOutput } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'ready' | 'error'

export const useAnalyzeStore = defineStore('analyze', () => {
  const phase = ref<Phase>('idle')
  const preview = ref<PreviewOutput | null>(null)
  const error = ref<ApiError | null>(null)

  async function analyze() {
    phase.value = 'loading'
    error.value = null
    try {
      preview.value = await postPreview()
      phase.value = 'ready'
    } catch (err) {
      error.value = err as ApiError
      preview.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    phase.value = 'idle'
    preview.value = null
    error.value = null
  }

  return { phase, preview, error, analyze, reset }
})
```

- [ ] **Step 5: Implement `stores/apply.ts`**

Create `packages/web/src/stores/apply.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { postApply } from '../api/client.js'
import type { ApiError, ApplyResult, LovelaceConfig } from '../api/types.js'

type Phase = 'idle' | 'applying' | 'success' | 'error'

export const useApplyStore = defineStore('apply', () => {
  const phase = ref<Phase>('idle')
  const result = ref<ApplyResult | null>(null)
  const error = ref<ApiError | null>(null)

  async function apply(config: LovelaceConfig) {
    phase.value = 'applying'
    error.value = null
    try {
      result.value = await postApply({ config })
      phase.value = 'success'
    } catch (err) {
      error.value = err as ApiError
      result.value = null
      phase.value = 'error'
    }
  }

  function reset() {
    phase.value = 'idle'
    result.value = null
    error.value = null
  }

  return { phase, result, error, apply, reset }
})
```

- [ ] **Step 6: Run the tests to verify they pass**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/stores/
```

Expected: PASS — 10 tests.

- [ ] **Step 7: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 8: Commit**

```bash
git -C <worktree> add packages/web/src/stores/analyze.ts \
        packages/web/src/stores/apply.ts \
        packages/web/src/__tests__/stores/analyze.test.ts \
        packages/web/src/__tests__/stores/apply.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): Pinia stores for analyze + apply state machines

Two decoupled setup-style stores:
- analyzeStore: phase = idle | loading | ready | error, calls
  postPreview() on analyze(), holds the PreviewOutput response.
- applyStore: phase = idle | applying | success | error, calls
  postApply({ config }) with a config the caller passes in. Doesn't
  import analyzeStore — components wire them at click time.

Both eagerly clear `error` when the action transitions to its in-flight
phase so a retry doesn't show stale error state during the new request.

P1a-10 layer 2 of 7 (stores).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: `RoomList.vue` + `roomIdToIcon` helper + tests

**Files:**
- Create: `packages/web/src/components/icons.ts`
- Create: `packages/web/src/components/RoomList.vue`
- Create: `packages/web/src/__tests__/components/RoomList.test.ts`

The `roomIdToIcon(roomId)` helper duplicates the canonical-room → icon mapping from `packages/generator/src/room-view.ts` (`ROOM_DISPLAY` table). 14 lines of duplication, DRY-able in P1b via a shared `@lovelacer/api-types` package.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/__tests__/components/RoomList.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import RoomList from '../../components/RoomList.vue'
import type { AnalyzedRoom } from '../../api/types.js'

function room(overrides: Partial<AnalyzedRoom> = {}): AnalyzedRoom {
  return {
    id: 'kitchen',
    haAreaId: 'kitchen',
    displayName: 'Kitchen',
    entityCount: 12,
    averageConfidence: 0.92,
    assignments: [],
    ...overrides,
  }
}

describe('RoomList', () => {
  it('renders one row per room', () => {
    const rooms = [
      room({ id: 'kitchen', displayName: 'Kitchen' }),
      room({ id: 'bedroom', displayName: 'Bedroom' }),
      room({ id: 'living_room', displayName: 'Living Room' }),
    ]
    const wrapper = mount(RoomList, { props: { rooms } })
    const rows = wrapper.findAll('[data-testid="room-row"]')
    expect(rows).toHaveLength(3)
  })

  it('shows entityCount as "N entities"', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ entityCount: 22 })] },
    })
    expect(wrapper.text()).toContain('22 entities')
  })

  it('uses green pill for confidence >= 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.92 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-green-100')
    expect(pill.classes()).toContain('text-green-800')
  })

  it('uses amber pill for confidence between 0.5 and 0.8', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.65 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-amber-100')
    expect(pill.classes()).toContain('text-amber-800')
  })

  it('uses red pill for confidence < 0.5', () => {
    const wrapper = mount(RoomList, {
      props: { rooms: [room({ averageConfidence: 0.3 })] },
    })
    const pill = wrapper.find('[data-testid="confidence-pill"]')
    expect(pill.classes()).toContain('bg-red-100')
    expect(pill.classes()).toContain('text-red-800')
  })

  it('renders empty-state placeholder when rooms array is empty', () => {
    const wrapper = mount(RoomList, { props: { rooms: [] } })
    expect(wrapper.text()).toContain('No rooms detected')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/components/RoomList.test.ts
```

Expected: FAIL — module not found for `../../components/RoomList.vue`.

- [ ] **Step 3: Implement `components/icons.ts`**

Create `packages/web/src/components/icons.ts`:

```ts
/**
 * Maps the analyzer's canonical room IDs to MDI icon strings used in
 * the dashboard preview. Mirrors the `ROOM_DISPLAY` table in
 * `packages/generator/src/room-view.ts`.
 *
 * Duplicated here (~14 lines) rather than fetched from the server so
 * the frontend is self-contained for offline rendering. P1b extracts
 * this into a shared `@lovelacer/api-types` package along with the
 * AnalyzedRoom etc. types.
 */
const ROOM_ICONS: Record<string, string> = {
  kitchen: 'mdi:silverware-fork-knife',
  living_room: 'mdi:sofa',
  bedroom: 'mdi:bed',
  bathroom: 'mdi:shower-head',
  office: 'mdi:desk',
  garage: 'mdi:garage-variant',
  garden: 'mdi:flower-tulip',
  dining_room: 'mdi:silverware',
  laundry: 'mdi:washing-machine',
  basement: 'mdi:stairs-down',
  attic: 'mdi:home-roof',
  kids_room: 'mdi:teddy-bear',
  guest_room: 'mdi:bed-empty',
  hallway: 'mdi:door',
  misc: 'mdi:dots-horizontal',
}

export function roomIdToIcon(roomId: string): string {
  return ROOM_ICONS[roomId] ?? 'mdi:home-outline'
}
```

- [ ] **Step 4: Implement `components/RoomList.vue`**

Create `packages/web/src/components/RoomList.vue`:

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import { roomIdToIcon } from './icons.js'
import type { AnalyzedRoom } from '../api/types.js'

defineProps<{ rooms: AnalyzedRoom[] }>()

function confidencePillClass(confidence: number): string {
  if (confidence >= 0.8) return 'bg-green-100 text-green-800'
  if (confidence >= 0.5) return 'bg-amber-100 text-amber-800'
  return 'bg-red-100 text-red-800'
}

function confidenceLabel(confidence: number): string {
  return `${Math.round(confidence * 100)}% avg confidence`
}
</script>

<template>
  <div v-if="rooms.length === 0" class="rounded border border-stone-200 bg-stone-50 p-6 text-sm text-stone-600">
    No rooms detected — check that your HA install has at least one area assigned to entities or
    device names matching room patterns.
  </div>

  <ul v-else class="divide-y divide-stone-100 rounded-lg border border-stone-200 bg-white">
    <li
      v-for="room in rooms"
      :key="room.id"
      data-testid="room-row"
      class="flex items-center justify-between gap-4 px-5 py-3"
    >
      <div class="flex items-center gap-3">
        <Icon :icon="roomIdToIcon(room.id)" class="h-5 w-5 text-stone-700" />
        <span class="text-sm font-medium text-stone-900">{{ room.displayName }}</span>
      </div>

      <div class="flex items-center gap-3 text-xs text-stone-600">
        <span>{{ room.entityCount }} entities</span>
        <span
          data-testid="confidence-pill"
          class="rounded px-2 py-0.5 text-xs font-medium"
          :class="confidencePillClass(room.averageConfidence)"
        >
          {{ confidenceLabel(room.averageConfidence) }}
        </span>
      </div>
    </li>
  </ul>
</template>
```

- [ ] **Step 5: Run the test to verify it passes**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/components/RoomList.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 6: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 7: Commit**

```bash
git -C <worktree> add packages/web/src/components/icons.ts \
        packages/web/src/components/RoomList.vue \
        packages/web/src/__tests__/components/RoomList.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): RoomList component + roomIdToIcon helper

One row per room with the analyzer's MDI icon (mapping mirrors
generator/src/room-view.ts ROOM_DISPLAY), entity count, and a
confidence pill colored by bucket: green ≥0.8, amber 0.5-0.8, red <0.5.
Empty state when rooms array is empty.

The icon helper duplicates ~14 lines from the generator. P1b extracts
both into a shared @lovelacer/api-types package.

P1a-10 layer 3 of 7 (RoomList).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `DashboardPreview.vue` + tests

**Files:**
- Create: `packages/web/src/components/DashboardPreview.vue`
- Create: `packages/web/src/__tests__/components/DashboardPreview.test.ts`

Pill-card grid showing each LovelaceView's title + icon. The `view.icon` strings (e.g., `mdi:home-variant`) come from the server-side generator and Iconify renders them directly via the bundled MDI set.

- [ ] **Step 1: Write the failing test**

Create `packages/web/src/__tests__/components/DashboardPreview.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { mount } from '@vue/test-utils'
import DashboardPreview from '../../components/DashboardPreview.vue'
import type { LovelaceConfig } from '../../api/types.js'

const config: LovelaceConfig = {
  title: 'Lovelacer — Home',
  views: [
    { type: 'sections', title: 'Home', path: 'home', icon: 'mdi:home-variant' },
    { type: 'sections', title: 'Kitchen', path: 'kitchen', icon: 'mdi:silverware-fork-knife' },
    { type: 'sections', title: 'Bedroom', path: 'bedroom', icon: 'mdi:bed' },
  ],
}

describe('DashboardPreview', () => {
  it('renders one pill per view in input order', () => {
    const wrapper = mount(DashboardPreview, { props: { config } })
    const pills = wrapper.findAll('[data-testid="view-pill"]')
    expect(pills).toHaveLength(3)
    expect(pills[0]!.text()).toContain('Home')
    expect(pills[1]!.text()).toContain('Kitchen')
    expect(pills[2]!.text()).toContain('Bedroom')
  })

  it('passes the view.icon string to the Iconify component', () => {
    const wrapper = mount(DashboardPreview, { props: { config } })
    const icons = wrapper.findAllComponents({ name: 'Icon' })
    expect(icons.length).toBeGreaterThanOrEqual(3)
    expect(icons[0]!.props('icon')).toBe('mdi:home-variant')
    expect(icons[1]!.props('icon')).toBe('mdi:silverware-fork-knife')
    expect(icons[2]!.props('icon')).toBe('mdi:bed')
  })

  it('renders nothing when views array is empty', () => {
    const empty: LovelaceConfig = { title: 'x', views: [] }
    const wrapper = mount(DashboardPreview, { props: { config: empty } })
    const pills = wrapper.findAll('[data-testid="view-pill"]')
    expect(pills).toHaveLength(0)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/components/DashboardPreview.test.ts
```

Expected: FAIL — module not found for `../../components/DashboardPreview.vue`.

- [ ] **Step 3: Implement `components/DashboardPreview.vue`**

Create `packages/web/src/components/DashboardPreview.vue`:

```vue
<script setup lang="ts">
import { Icon } from '@iconify/vue'
import type { LovelaceConfig } from '../api/types.js'

defineProps<{ config: LovelaceConfig }>()
</script>

<template>
  <section v-if="config.views.length > 0">
    <h3 class="mb-3 text-sm font-medium text-stone-700">
      Will create {{ config.views.length }} dashboard {{ config.views.length === 1 ? 'view' : 'views' }}
    </h3>
    <ul class="flex flex-wrap gap-2">
      <li
        v-for="view in config.views"
        :key="view.path"
        data-testid="view-pill"
        class="inline-flex items-center gap-1.5 rounded-full border border-stone-200 bg-white px-3 py-1 text-xs font-medium text-stone-700"
      >
        <Icon :icon="view.icon" class="h-4 w-4" />
        <span>{{ view.title }}</span>
      </li>
    </ul>
  </section>
</template>
```

- [ ] **Step 4: Run the test to verify it passes**

```bash
pnpm --dir <worktree> vitest run packages/web/src/__tests__/components/DashboardPreview.test.ts
```

Expected: PASS — 3 tests.

- [ ] **Step 5: Verify the broader build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/web/src/components/DashboardPreview.vue \
        packages/web/src/__tests__/components/DashboardPreview.test.ts
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): DashboardPreview pill-card grid

Renders one pill per LovelaceView from /api/preview's config — Iconify
renders the view.icon strings directly via the bundled MDI set.
Header counts views with correct singular/plural. Hidden when views
array is empty.

P1a-10 layer 4 of 7 (DashboardPreview).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Glue components — HealthBar, AnalyzeButton, MiscBucket, ApplyBar

**Files:**
- Create: `packages/web/src/components/HealthBar.vue`
- Create: `packages/web/src/components/AnalyzeButton.vue`
- Create: `packages/web/src/components/MiscBucket.vue`
- Create: `packages/web/src/components/ApplyBar.vue`

Four thin glue components. No unit tests (per spec) — covered by store tests + the P1a-11 smoke test.

- [ ] **Step 1: Implement `components/HealthBar.vue`**

Extracts the existing health UI from `App.vue` verbatim. Read `packages/web/src/App.vue` first to confirm the existing implementation.

Create `packages/web/src/components/HealthBar.vue`:

```vue
<script setup lang="ts">
import { ref, onMounted } from 'vue'

interface HealthResponse {
  ok: boolean
  version: string
  ha: { connected: boolean }
}

const health = ref<HealthResponse | null>(null)
const error = ref<string | null>(null)

async function fetchHealth() {
  try {
    // Use a document-relative URL (no leading slash) so the request stays
    // inside the add-on path under HA Supervisor ingress, where the SPA is
    // served from a `/api/hassio_ingress/<token>/` prefix. Vite's dev proxy
    // also resolves this correctly to the backend at :3000.
    const res = await fetch('api/health')
    if (!res.ok) throw new Error(`HTTP ${res.status}`)
    health.value = await res.json()
    error.value = null
  } catch (err) {
    error.value = err instanceof Error ? err.message : 'unknown error'
  }
}

onMounted(() => {
  void fetchHealth()
})
</script>

<template>
  <section class="rounded-lg border border-stone-200 bg-white p-4 shadow-sm">
    <div v-if="error" class="text-sm text-brand-800">
      Backend unreachable: {{ error }}
    </div>

    <div v-else-if="!health" class="text-sm text-stone-500">Loading…</div>

    <div v-else class="flex items-center justify-between text-sm">
      <span class="text-stone-600">
        Version <span class="font-mono text-stone-900">{{ health.version }}</span>
      </span>
      <span
        class="inline-block rounded px-2 py-0.5 text-xs font-medium"
        :class="
          health.ha.connected ? 'bg-green-100 text-green-800' : 'bg-stone-200 text-stone-700'
        "
      >
        HA {{ health.ha.connected ? 'connected' : 'disconnected' }}
      </span>
    </div>
  </section>
</template>
```

- [ ] **Step 2: Implement `components/AnalyzeButton.vue`**

Create `packages/web/src/components/AnalyzeButton.vue`:

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'

const analyze = useAnalyzeStore()
const apply = useApplyStore()

// Disabled while either store is mid-flight to prevent racing the
// in-progress request. Re-enabled in idle/ready/error/success.
const disabled = computed(
  () => analyze.phase === 'loading' || apply.phase === 'applying',
)

const label = computed(() => (analyze.phase === 'loading' ? 'Analyzing…' : 'Analyze'))
</script>

<template>
  <button
    type="button"
    class="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
    :disabled="disabled"
    @click="analyze.analyze()"
  >
    {{ label }}
  </button>
</template>
```

- [ ] **Step 3: Implement `components/MiscBucket.vue`**

Create `packages/web/src/components/MiscBucket.vue`:

```vue
<script setup lang="ts">
import type { MiscEntity } from '../api/types.js'

defineProps<{ misc: MiscEntity[] }>()
</script>

<template>
  <details v-if="misc.length > 0" class="rounded-lg border border-stone-200 bg-white px-5 py-3">
    <summary class="cursor-pointer text-sm font-medium text-stone-700">
      {{ misc.length }} entities not assigned to any room
    </summary>
    <ul class="mt-3 space-y-1 text-xs text-stone-600">
      <li v-for="entity in misc" :key="entity.entityId" class="flex items-center justify-between">
        <span class="font-mono">{{ entity.entityId }}</span>
        <span class="text-stone-500">{{ entity.friendlyName }}</span>
      </li>
    </ul>
  </details>
</template>
```

- [ ] **Step 4: Implement `components/ApplyBar.vue`**

Create `packages/web/src/components/ApplyBar.vue`:

```vue
<script setup lang="ts">
import { computed, onUnmounted, watch } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'

const analyze = useAnalyzeStore()
const apply = useApplyStore()

let resetTimer: ReturnType<typeof setTimeout> | null = null

function clearTimer() {
  if (resetTimer !== null) {
    clearTimeout(resetTimer)
    resetTimer = null
  }
}

function startOver() {
  clearTimer()
  apply.reset()
  analyze.reset()
}

// 5s auto-dismiss after success, per spec. Clearing the timer on
// unmount avoids `apply.reset()` firing against a stale store if the
// component is destroyed while the timer is pending.
watch(
  () => apply.phase,
  (phase) => {
    clearTimer()
    if (phase === 'success') {
      resetTimer = setTimeout(startOver, 5000)
    }
  },
)

onUnmounted(clearTimer)

function applyClicked() {
  if (analyze.preview === null) return
  void apply.apply(analyze.preview.config)
}

const errorMessage = computed(() => {
  if (apply.error === null) return ''
  switch (apply.error.error) {
    case 'ha_unavailable':
      return 'Home Assistant is not connected. Check the connection bar at the top.'
    case 'invalid_config':
      return 'Cached config is invalid. Click Start over to re-analyze.'
    case 'ha_apply_failed':
      return `Apply failed at step ${apply.error.step ?? 'unknown'}: ${apply.error.message}`
    default:
      return apply.error.message
  }
})

const showRetry = computed(
  () =>
    apply.error !== null &&
    apply.error.error !== 'ha_unavailable' &&
    apply.error.error !== 'invalid_config',
)
</script>

<template>
  <section>
    <button
      v-if="apply.phase === 'idle' || apply.phase === 'applying'"
      type="button"
      class="w-full rounded bg-brand-600 px-5 py-3 text-sm font-medium text-white shadow-sm hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
      :disabled="apply.phase === 'applying' || analyze.phase !== 'ready'"
      @click="applyClicked"
    >
      {{ apply.phase === 'applying' ? 'Applying…' : 'Apply to Home Assistant' }}
    </button>

    <div
      v-else-if="apply.phase === 'success' && apply.result !== null"
      class="flex items-center justify-between rounded-lg border border-green-200 bg-green-50 px-5 py-3 text-sm text-green-900"
    >
      <span>
        Dashboard <span class="font-mono">{{ apply.result.urlPath }}</span>
        {{ apply.result.created ? 'created' : 'updated' }}.
      </span>
      <button
        type="button"
        class="rounded bg-green-600 px-3 py-1 text-xs font-medium text-white hover:bg-green-700"
        @click="startOver"
      >
        Done — start over
      </button>
    </div>

    <div
      v-else-if="apply.phase === 'error'"
      class="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900"
    >
      <span>{{ errorMessage }}</span>
      <button
        v-if="showRetry"
        type="button"
        class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        @click="applyClicked"
      >
        Retry
      </button>
      <button
        v-else
        type="button"
        class="rounded bg-stone-600 px-3 py-1 text-xs font-medium text-white hover:bg-stone-700"
        @click="startOver"
      >
        Start over
      </button>
    </div>
  </section>
</template>
```

- [ ] **Step 5: Verify typecheck**

```bash
pnpm --dir <worktree> typecheck
```

Expected: PASS. (No tests yet — all four components are smoke-tested via App.vue integration in the next task.)

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/web/src/components/HealthBar.vue \
        packages/web/src/components/AnalyzeButton.vue \
        packages/web/src/components/MiscBucket.vue \
        packages/web/src/components/ApplyBar.vue
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): glue components — HealthBar, AnalyzeButton, MiscBucket, ApplyBar

- HealthBar: extracts existing health UI verbatim, polls /api/health
  on mount, shows version + HA connection badge.
- AnalyzeButton: dispatches analyzeStore.analyze(), disabled while
  either store is in-flight.
- MiscBucket: collapsible <details> listing the analyze response's
  misc entities. Renders nothing when the array is empty.
- ApplyBar: idle/applying/success/error states. 5s auto-dismiss timer
  after success, cleared on unmount or manual Start over. Maps the
  ApiError discriminator to user-facing messages and decides whether
  to surface a Retry button (skipped for ha_unavailable + invalid_config
  per spec — user fixes the underlying condition first).

P1a-10 layer 5 of 7 (glue components). App.vue composition next.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 7: `App.vue` composition + manual smoke verification

**Files:**
- Modify: `packages/web/src/App.vue`

Replace the existing health-check-only `App.vue` with the full composition. Read the current file first to preserve the page chrome (`<main class="mx-auto max-w-2xl p-8">`, header).

- [ ] **Step 1: Read the current `App.vue`**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/<worktree>/packages/web/src/App.vue
```

Confirm the structure matches the spec's understanding. The header h1 ("Lovelacer") and chrome stay; the inner status section is replaced.

- [ ] **Step 2: Replace `App.vue`**

Write the new contents:

```vue
<script setup lang="ts">
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import { useAnalyzeStore } from './stores/analyze.js'

const analyze = useAnalyzeStore()
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-8">
    <header>
      <h1 class="text-3xl font-semibold text-stone-900">Lovelacer</h1>
      <p class="text-sm text-stone-600">Home Assistant dashboard generator · alpha</p>
    </header>

    <HealthBar />

    <section class="flex justify-center">
      <AnalyzeButton />
    </section>

    <section
      v-if="analyze.phase === 'error' && analyze.error !== null"
      class="rounded-lg border border-red-200 bg-red-50 px-5 py-3 text-sm text-red-900"
    >
      <div class="flex items-center justify-between">
        <span>{{ analyze.error.message }}</span>
        <button
          type="button"
          class="rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          @click="analyze.analyze()"
        >
          Retry
        </button>
      </div>
    </section>

    <section
      v-if="analyze.phase === 'ready' && analyze.preview !== null"
      class="space-y-4"
    >
      <RoomList :rooms="analyze.preview.rooms" />
      <MiscBucket :misc="analyze.preview.misc" />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>
</template>
```

- [ ] **Step 3: Verify the build**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> test
pnpm --dir <worktree> --filter @lovelacer/web build
```

All three pass. The build produces `packages/web/dist/index.html` + bundled JS/CSS.

- [ ] **Step 4: Manual smoke verification (dev server)**

This is for the implementer to run locally; no automated test. Skip if running in CI/agentic context where there's no HA backend — leave a note in the report instead.

```bash
# Terminal 1: start the server
pnpm --dir <worktree> --filter @lovelacer/server dev

# Terminal 2: start the web dev server
pnpm --dir <worktree> --filter @lovelacer/web dev
```

Open `http://localhost:5173`:
- HealthBar should show version + HA status (likely disconnected without real HA — that's fine).
- "Analyze" button should appear and be clickable.
- If HA is disconnected, clicking Analyze surfaces the error banner with a Retry button.

If running against a real HA, the full flow should work end-to-end. Report observations (or "no HA available — skipped manual smoke") in the agent report.

- [ ] **Step 5: Run the full verification suite**

```bash
pnpm --dir <worktree> typecheck
pnpm --dir <worktree> -r test
pnpm --dir <worktree> format:check
pnpm --dir <worktree> lint
```

All green. If `format:check` fails, run `pnpm --dir <worktree> format`, stage, and retry. If `lint` reports `vue/one-component-per-file` warnings on .ts test files: that's the bug fixed in P1a-7's eslint config (commit `a15ab37`); already on main. If you see new vue rule warnings, mention them in the report.

- [ ] **Step 6: Commit**

```bash
git -C <worktree> add packages/web/src/App.vue
git -C <worktree> commit -m "$(cat <<'EOF'
feat(web): App.vue composes the full Analyze → Apply flow

Replaces the health-check-only App.vue with the full single-page flow:
HealthBar at the top, AnalyzeButton centered, then conditional sections
for the analyze-level error banner and the review/apply section that
appears once analyzeStore.phase === 'ready'. Closes P1a-10.

P1a-10 final layer (composition). Phase 1a alpha demo flow now wired
end-to-end: click Analyze → see rooms with confidence summaries +
dashboard preview → click Apply → success banner with auto-reset.

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1a-10 Acceptance Confirmation

- [ ] `npm run dev` (or `pnpm --filter @lovelacer/web dev`) renders the Lovelacer header, HealthBar, and Analyze button.
- [ ] Clicking Analyze with no backend running shows the error banner with Retry.
- [ ] All ~24 unit tests passing (6 client + 5 + 5 stores + 6 RoomList + 3 DashboardPreview).
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` clean.
- [ ] No frontend imports from `@lovelacer/server`.
- [ ] Iconify renders MDI strings via the bundled set (no CDN runtime dep).
- [ ] No real-HA integration test introduced; that's P1a-11.
