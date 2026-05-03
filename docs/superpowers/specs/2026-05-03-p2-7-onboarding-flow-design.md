# P2-7 — Onboarding Flow — Design

**Status:** Draft v1 · **Date:** 2026-05-03 · **Phase:** 2 (Polish & Release) · **Sizing:** M

## Goal

Replace the empty post-invite state with a 3-screen full-screen wizard that walks first-run users through language selection, dashboard preview, and apply. The wizard appears once on a fresh install and never again — its completion (via Apply success or explicit Skip) is persisted in SQLite. Users who want to revisit settings later use the existing Settings modal.

**Acceptance criteria** (from ROADMAP.md):

- Fresh install with no DB state shows the wizard.
- Completed state stored, doesn't re-show.

## Context

Phase 2 ticket 7. Phase 2 has shipped P2-1 (re-analysis diff view), P2-2 (YAML export), P2-3 (floor-aware grouping), P2-4 (misc bucket bulk UX), P2-5 (suggestions panel), and P2-6 (settings screen). Sizing per ROADMAP: M (~2-3 evenings).

The current empty state is just `<AnalyzeButton>` with no orientation. There's no explanation of what the app does, no opinionated default flow, and no language picker visible until the user discovers the gear icon. P2-7 fixes that with a structured first-run experience.

The wizard sits BETWEEN invite acceptance (P1b-6) and the main app view. It uses existing infrastructure aggressively:

- Language step writes via `useSettingsStore.saveAndReanalyze()` (P2-6) — kicks off `settings.put` + `analyze.analyze` in one call.
- Preview step renders the existing `DashboardPreview` component (P1a-9) with a read-only `RoomList` + `MiscBucket` toggle.
- Apply step delegates to `useApplyStore.apply()` (P1a-8). On success, the wizard's watch fires `onboarding.complete()`.
- Skip flow on any step calls `onboarding.complete()` then `analyze.analyze()` so the user lands on a populated post-onboarding view.

The wizard introduces one new persistence layer: a single-row `OnboardingStore` mirroring `InviteStore`. `completedAt` is `null` (not done) or a unix timestamp. The frontend's `shouldShowWizard` computed gate flips `false` once `completedAt` is set.

## Architecture & data flow

Five pieces:

1. **`OnboardingStore` SQLite single-row table** (`packages/server/src/storage/onboarding-store.ts`). Mirrors `InviteStore`. One row, one column: `completed_at INTEGER NOT NULL`. Absence of row = not completed. `complete()` is idempotent via INSERT OR REPLACE.

2. **API endpoints** (`packages/server/src/routes/onboarding.ts`):
   - `GET /api/onboarding` — returns `{ completedAt: number | null }`.
   - `POST /api/onboarding/complete` — returns `{ completedAt: number }`. No body. Idempotent.

3. **`useOnboardingStore` Pinia store** (`packages/web/src/stores/onboarding.ts`):
   - `phase: 'idle' | 'loading' | 'completing' | 'error'`
   - `completedAt: number | null | undefined` (undefined = not yet loaded)
   - `shouldShowWizard: computed<boolean>` — true only when `completedAt === null` (loaded, not completed)
   - `loadStatus()`, `complete()`

4. **`OnboardingWizard.vue`** — full-screen takeover. Internal step state: `'welcome' | 'preview' | 'done'`. Renders one of three sub-step components: `WelcomeStep`, `PreviewStep`, `DoneStep`. Owns step transitions and skip handling.

5. **`App.vue` gating** — sequential v-ifs:
   - InviteGate first (modal, highest z-index).
   - OnboardingWizard next (full-screen, replaces `<main>`).
   - Main view otherwise.

**Data flow on a fresh install:**

```
mount → invite.loadStatus() + onboarding.loadStatus() (parallel)
  ↓ invite accepted (true)
  ↓ onboarding.completedAt === null
  → wizard renders (WelcomeStep)

User picks language → "Continue":
  settings.setLanguage(lang)
  await settings.saveAndReanalyze()  ← PUT settings + analyze.analyze
  step = 'preview'

User clicks Apply on PreviewStep:
  apply.apply(...)
  on apply.phase === 'success': wizard's watch fires
    onboarding.complete()
    step = 'done'

User clicks "Continue to Lovelacer" on DoneStep:
  // shouldShowWizard is now false (completedAt was set)
  // wizard unmounts, main App content renders naturally
```

**Skip flow** (from any step):

```
if settings.hasDirty:
  await settings.saveAndReanalyze()   ← preserves language pick
else:
  void analyze.analyze()              ← fire-and-forget so user lands on populated view
await onboarding.complete()           ← marks done
// shouldShowWizard flips false; wizard unmounts; main view renders
```

## OnboardingStore

`packages/server/src/storage/onboarding-store.ts`:

```sql
CREATE TABLE IF NOT EXISTS onboarding (
  id           INTEGER PRIMARY KEY CHECK (id = 1),
  completed_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Single-row table (CHECK id=1) — only one row ever exists. Absence of row = not yet completed.

```ts
export interface OnboardingStatus {
  completedAt: number | null
}

export class OnboardingStore {
  constructor(filename: string)
  /** Returns { completedAt: null } if no row exists. */
  get(): OnboardingStatus
  /** INSERT OR REPLACE — idempotent. Returns the persisted timestamp. */
  complete(): OnboardingStatus
  close(): void
}
```

Constructor accepts `':memory:'` for tests; for file paths, `mkdirSync(dirname, { recursive: true })`. Pragma `journal_mode = WAL`. Prepared statements (stmtGet, stmtComplete) hoisted in the constructor.

`main.ts` instantiates the store at the same SQLite file path as the others (`config.dataDir + '/lovelacer.sqlite'`), passes it to `createApp`, closes on shutdown.

## API + persistence wiring

**`GET /api/onboarding`** — returns `{ completedAt: number | null }`. No body validation (no body).

**`POST /api/onboarding/complete`** — returns `{ completedAt: number }`. No body — idempotent. Errors:

- `500 storage_error` — better-sqlite3 threw.

```ts
export const onboardingRoute: FastifyPluginAsync<OnboardingRouteOptions> = async (app, opts) => {
  app.get('/api/onboarding', async () => {
    return opts.onboarding.get()
  })

  app.post('/api/onboarding/complete', async (req, reply) => {
    try {
      return opts.onboarding.complete()
    } catch (err) {
      req.log.error({ err }, 'onboarding complete failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
```

`CreateAppOptions.onboarding: OnboardingStore` is added. The route is registered between `settingsRoute` and `suggestionsRoute` in `app.ts`. Invite gate (P1b-6) covers `/api/onboarding` automatically; one new test in `invite-gate.test.ts` pins the contract for both verbs.

## Pinia store

`packages/web/src/stores/onboarding.ts`:

```ts
type Phase = 'idle' | 'loading' | 'completing' | 'error'

export const useOnboardingStore = defineStore('onboarding', () => {
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)
  /**
   * undefined = haven't loaded yet (avoids first-paint flash)
   * null = loaded, not completed (wizard shows)
   * number = completed (wizard hidden)
   */
  const completedAt = ref<number | null | undefined>(undefined)

  const shouldShowWizard = computed<boolean>(() => completedAt.value === null)

  async function loadStatus(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getOnboarding()
      completedAt.value = result.completedAt
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function complete(): Promise<void> {
    phase.value = 'completing'
    error.value = null
    try {
      const result = await postOnboardingComplete()
      completedAt.value = result.completedAt
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
      throw err
    }
  }

  return { phase, error, completedAt, shouldShowWizard, loadStatus, complete }
})
```

The three-state `completedAt` (undefined / null / number) avoids a first-paint flash. `shouldShowWizard` is strictly `true` only when `completedAt === null` (we know we've loaded AND know there's no completion). Mirror of `useInviteStore.shouldShowGate`'s pattern.

## OnboardingWizard component

`packages/web/src/components/OnboardingWizard.vue`:

```vue
<script setup lang="ts">
import { ref, watch } from 'vue'
import { useAnalyzeStore } from '../stores/analyze.js'
import { useApplyStore } from '../stores/apply.js'
import { useOnboardingStore } from '../stores/onboarding.js'
import { useSettingsStore } from '../stores/settings.js'
import WelcomeStep from './onboarding/WelcomeStep.vue'
import PreviewStep from './onboarding/PreviewStep.vue'
import DoneStep from './onboarding/DoneStep.vue'
import ProgressDots from './onboarding/ProgressDots.vue'

type Step = 'welcome' | 'preview' | 'done'

const currentStep = ref<Step>('welcome')

const onboarding = useOnboardingStore()
const settings = useSettingsStore()
const analyze = useAnalyzeStore()
const apply = useApplyStore()

// On apply success, mark onboarding complete and advance to Done.
watch(
  () => apply.phase,
  async (phase) => {
    if (phase === 'success' && currentStep.value === 'preview') {
      try {
        await onboarding.complete()
      } catch {
        // Silent retry on next loadStatus. Advance anyway — the user's
        // dashboard is already live in HA.
      }
      currentStep.value = 'done'
    }
  },
)

async function onContinueFromWelcome(): Promise<void> {
  await settings.saveAndReanalyze()
  currentStep.value = 'preview'
}

async function onSkip(): Promise<void> {
  // Preserve language pick if user changed it on the welcome step.
  if (settings.hasDirty) {
    await settings.saveAndReanalyze()
  } else {
    void analyze.analyze() // populate the post-onboarding view
  }
  try {
    await onboarding.complete()
  } catch {
    // Silent — main view will retry via the next loadStatus.
  }
  // Wizard unmounts via App.vue's shouldShowWizard flip.
}

function onFinishFromDone(): void {
  // No action — shouldShowWizard already false (complete ran on apply success).
  // Vue will unmount the wizard on the next render.
}
</script>

<template>
  <div
    data-testid="onboarding-wizard"
    class="fixed inset-0 z-30 flex items-center justify-center bg-stone-50 p-8 overflow-y-auto"
  >
    <div class="w-full max-w-2xl">
      <ProgressDots :current="currentStep" :steps="['welcome', 'preview', 'done']" />

      <WelcomeStep
        v-if="currentStep === 'welcome'"
        @continue="onContinueFromWelcome"
        @skip="onSkip"
      />
      <PreviewStep
        v-else-if="currentStep === 'preview'"
        @back="currentStep = 'welcome'"
        @skip="onSkip"
      />
      <DoneStep v-else @finish="onFinishFromDone" @skip="onSkip" />
    </div>
  </div>
</template>
```

**`ProgressDots.vue`** — small component: 3 dots/labels, current step highlighted. Pure UI.

**`WelcomeStep.vue`:**

```vue
<script setup lang="ts">
import { useSettingsStore } from '../../stores/settings.js'
import type { SettingsLanguage } from '../../api/types.js'

const emit = defineEmits<{ continue: []; skip: [] }>()
const settings = useSettingsStore()
</script>

<template>
  <div data-testid="welcome-step" class="rounded-lg bg-white p-8 shadow-sm">
    <h1 class="text-2xl font-semibold text-stone-900">Welcome to Lovelacer</h1>
    <p class="mt-2 text-stone-600">
      Lovelacer scans your Home Assistant entities and generates a Lovelace dashboard automatically.
      Pick your detection language, then we'll show you a preview.
    </p>

    <label for="welcome-language" class="mt-6 block text-sm font-medium text-stone-700">
      Detection language
    </label>
    <select
      id="welcome-language"
      data-testid="welcome-language"
      class="mt-1 w-full rounded border border-stone-300 px-2 py-1.5"
      :value="settings.effective.language"
      @change="settings.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)"
    >
      <option value="auto">Auto (match all)</option>
      <option value="en">English</option>
      <option value="cs">Čeština</option>
    </select>

    <button
      type="button"
      data-testid="welcome-continue"
      class="mt-6 w-full rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
      @click="emit('continue')"
    >
      Continue
    </button>

    <button
      type="button"
      data-testid="welcome-skip"
      class="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      @click="emit('skip')"
    >
      Skip onboarding
    </button>
  </div>
</template>
```

**`PreviewStep.vue`:**

```vue
<script setup lang="ts">
import { computed, ref } from 'vue'
import { useAnalyzeStore } from '../../stores/analyze.js'
import { useApplyStore } from '../../stores/apply.js'
import DashboardPreview from '../DashboardPreview.vue'
import RoomList from '../RoomList.vue'
import MiscBucket from '../MiscBucket.vue'
import type { SnapshotAssignment } from '../../api/types.js'

const emit = defineEmits<{ back: []; skip: [] }>()

const analyze = useAnalyzeStore()
const apply = useApplyStore()
const showDetails = ref(false)

const summary = computed(() => {
  const p = analyze.preview
  if (p === null) return ''
  return `Detected ${p.summary.entityCount} entities across ${p.summary.roomCount} rooms.`
})

function applyClicked(): void {
  if (analyze.preview === null) return
  const assignments: SnapshotAssignment[] = []
  for (const room of analyze.preview.rooms) {
    for (const a of room.assignments) {
      assignments.push({ entityId: a.entityId, roomId: room.id })
    }
  }
  for (const m of analyze.preview.misc) {
    assignments.push({ entityId: m.entityId, roomId: null })
  }
  void apply.apply({
    config: analyze.preview.config,
    snapshot: { assignments, config: analyze.preview.config },
  })
}
</script>

<template>
  <div data-testid="preview-step" class="rounded-lg bg-white p-8 shadow-sm">
    <h1 class="text-2xl font-semibold text-stone-900">Preview</h1>

    <!-- Loading state -->
    <p v-if="analyze.phase === 'loading'" class="mt-4 text-stone-600">Scanning…</p>

    <!-- Analyze error -->
    <div
      v-else-if="analyze.phase === 'error' && analyze.error !== null"
      class="mt-4 rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
    >
      <p>{{ analyze.error.message }}</p>
      <button
        type="button"
        class="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
        @click="analyze.analyze()"
      >
        Retry
      </button>
    </div>

    <!-- Preview ready -->
    <div v-else-if="analyze.preview !== null" class="mt-4 space-y-4">
      <p class="text-stone-600">{{ summary }}</p>

      <DashboardPreview :config="analyze.preview.config" />

      <details class="rounded border border-stone-200 px-4 py-2">
        <summary class="cursor-pointer text-sm font-medium text-stone-700">Show breakdown</summary>
        <div class="mt-3 space-y-3">
          <RoomList
            :rooms="analyze.preview.rooms"
            :diff-by-room="{}"
            :diff-by-entity-id="new Map()"
            :read-only="true"
          />
          <MiscBucket :misc="analyze.preview.misc" :read-only="true" />
        </div>
      </details>

      <!-- Apply error -->
      <div
        v-if="apply.phase === 'error' && apply.error !== null"
        class="rounded border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-900"
      >
        <p>Apply failed: {{ apply.error.message }}</p>
        <button
          type="button"
          class="mt-2 rounded bg-red-600 px-3 py-1 text-xs font-medium text-white hover:bg-red-700"
          @click="applyClicked"
        >
          Retry
        </button>
      </div>
    </div>

    <!-- Footer -->
    <div class="mt-6 flex items-center justify-between">
      <button
        type="button"
        data-testid="preview-back"
        class="text-sm text-stone-500 hover:text-stone-700"
        @click="emit('back')"
      >
        ← Back
      </button>
      <button
        type="button"
        data-testid="preview-apply"
        class="rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:bg-stone-300"
        :disabled="analyze.phase !== 'ready' || apply.phase === 'applying'"
        @click="applyClicked"
      >
        {{ apply.phase === 'applying' ? 'Applying…' : 'Apply to Home Assistant' }}
      </button>
    </div>

    <button
      type="button"
      data-testid="preview-skip"
      class="mt-3 w-full text-sm text-stone-500 hover:text-stone-700"
      @click="emit('skip')"
    >
      Skip onboarding
    </button>
  </div>
</template>
```

**`DoneStep.vue`:**

```vue
<script setup lang="ts">
import { computed } from 'vue'
import { useApplyStore } from '../../stores/apply.js'

const emit = defineEmits<{ finish: []; skip: [] }>()
const apply = useApplyStore()

const dashboardPath = computed(() => apply.result?.urlPath ?? 'lovelacer-home')
const dashboardUrl = computed(() => `/lovelace/${dashboardPath.value}`)

function openDashboard(): void {
  window.open(dashboardUrl.value, '_blank')
}
</script>

<template>
  <div data-testid="done-step" class="rounded-lg bg-white p-8 text-center shadow-sm">
    <div class="mx-auto h-12 w-12 rounded-full bg-green-100 flex items-center justify-center">
      <span class="text-2xl text-green-600">✓</span>
    </div>
    <h1 class="mt-4 text-2xl font-semibold text-stone-900">All set!</h1>
    <p class="mt-2 text-stone-600">
      Your dashboard is at <code class="font-mono text-sm">{{ dashboardUrl }}</code
      >.
    </p>

    <div class="mt-6 space-y-2">
      <button
        type="button"
        data-testid="done-open-dashboard"
        class="w-full rounded bg-brand-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-brand-700"
        @click="openDashboard"
      >
        Open dashboard
      </button>
      <button
        type="button"
        data-testid="done-finish"
        class="w-full rounded border border-stone-300 px-5 py-2.5 text-sm font-medium text-stone-700 hover:bg-stone-50"
        @click="emit('finish')"
      >
        Continue to Lovelacer
      </button>
    </div>
  </div>
</template>
```

## App.vue gating

```vue
<script setup lang="ts">
import OnboardingWizard from './components/OnboardingWizard.vue'
import { useOnboardingStore } from './stores/onboarding.js'

const onboarding = useOnboardingStore()

const showWizard = computed(() => invite.accepted === true && onboarding.shouldShowWizard)
const showMainView = computed(
  () =>
    invite.accepted === true &&
    onboarding.completedAt !== null &&
    onboarding.completedAt !== undefined,
)

onMounted(() => {
  void invite.loadStatus()
  void onboarding.loadStatus()
})
</script>

<template>
  <main v-if="showMainView" class="mx-auto max-w-3xl space-y-6 p-8">
    <!-- existing main content unchanged -->
  </main>

  <OnboardingWizard v-else-if="showWizard" />

  <SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />
  <InviteGate v-if="invite.shouldShowGate" />
</template>
```

**Three view states cleanly separated:**

| State                               | InviteGate | Wizard | Main view |
| ----------------------------------- | ---------- | ------ | --------- |
| Loading (initial)                   | hidden     | hidden | hidden    |
| Invite needed                       | shown      | hidden | hidden    |
| Invite accepted, onboarding pending | hidden     | shown  | hidden    |
| Invite accepted, onboarding done    | hidden     | hidden | shown     |

No first-paint flash: until both `invite.accepted` and `onboarding.completedAt` are loaded, all three are hidden.

## Read-only props on RoomList + MiscBucket

Two existing components gain an optional `readOnly?: boolean` prop (default `false`):

**`RoomList.vue`:**

- When `readOnly: true`, the per-entity override dropdown (`<select>` for room reassignment) is hidden. Only the entity name + room badge shows.
- Implementation: pass `:read-only="readOnly"` from `RoomList` to each `EntityRow`. `EntityRow` adds the same `readOnly?: boolean` prop and conditionally renders the dropdown.

**`MiscBucket.vue`:**

- When `readOnly: true`, the bulk-select checkboxes, per-row hide toggle, and bulk action bar are hidden. Only the read-only entity list shows.

Both changes are minimal and additive; existing call sites work unchanged.

## Edge cases and error handling

- **First paint flash.** `completedAt: undefined` (not loaded) → all three views hidden. Until both `invite.loadStatus` and `onboarding.loadStatus` resolve, the user sees a blank page. Mirrors invite gate's no-flash pattern.

- **Skip preserves language pick.** If `settings.hasDirty` (user picked a language but skipped without continuing), `onSkip` calls `settings.saveAndReanalyze()` first — preserves their pick AND populates `analyze.preview` for the post-skip view. If not dirty, `onSkip` calls `void analyze.analyze()` directly (cheaper, doesn't need a settings PUT round-trip).

- **Apply fails during PreviewStep.** `apply.phase === 'error'` → PreviewStep renders an inline error banner with Retry. `onboarding.complete()` is NOT called — wizard stays on PreviewStep. User can fix and retry, or skip out, or go Back to change language.

- **Analyze fails during PreviewStep entry.** `analyze.phase === 'error'` → PreviewStep renders an error banner with Retry (calls `analyze.analyze()`) and Back (returns to WelcomeStep). The user can change language and retry.

- **`onboarding.complete()` POST fails on Apply success.** The dashboard is already live in HA. Wizard's watch fires `onboarding.complete()`, which silently catches and advances to DoneStep anyway. Next visit retries via `loadStatus`. If complete persistently fails, user persists in seeing the wizard on next visit until they apply again or click Skip — tolerable for a rare failure mode.

- **`onboarding.complete()` POST fails on Skip.** Skip handler also silently catches. Wizard unmounts because `analyze.analyze()` already kicked the user toward the main view, but the next page-load will see the wizard again. Same tolerable degradation.

- **Concurrent skip + complete (race).** If the user clicks Skip a tick before the apply-success watch fires, both POST. Idempotent (INSERT OR REPLACE), last-write-wins on the timestamp. Safe.

- **Re-running the wizard later.** Out of scope. The wizard never re-shows after `completedAt` is set. Settings (language, sections, card pack) are reachable via the Settings modal landed in P2-6.

- **Language pre-selected on WelcomeStep.** `settings.effective.language` is the source. On a fresh install, this is `DEFAULT_SETTINGS.language === 'auto'`. If settings somehow had a row before the wizard ran (unusual, e.g., DB seeded), the user sees their existing language pre-selected — correct behavior.

- **Apply succeeds on second visit (user skipped first time, now actually applies).** `appliedSnapshot.get()` is null on first onboarding skip → no diff baseline. Second visit: wizard doesn't show (`completedAt` is set). User clicks Apply via the regular ApplyBar. Snapshot is written. Diff vs nothing → no diff (first apply). Standard P2-1 behavior.

- **Settings gear inaccessible during wizard.** The header (with the gear icon) lives inside `<main>`. During the wizard, `<main>` is unmounted (via `v-if="showMainView"`), so the gear isn't reachable. That's intentional — the wizard owns the language pick. After the wizard closes, settings are reachable as normal.

- **Wizard mid-render unmount.** If the user does something that flips `showWizard` to false (e.g., `onboarding.complete()` resolves), the wizard unmounts immediately. Vue handles reactive `v-if` cleanly. No race conditions.

## Testing strategy

**`packages/server/src/storage/__tests__/onboarding-store.test.ts`** — `:memory:` DB:

- Empty store → `get()` returns `{ completedAt: null }`.
- `complete()` → returns `{ completedAt: <number> }`, store now reflects that timestamp on subsequent `get()`.
- `complete()` twice → idempotent (INSERT OR REPLACE updates the timestamp).
- File-backed: persists across instances.
- File-backed: creates parent dir if missing.

**`packages/server/src/__tests__/routes/onboarding.test.ts`** — `app.inject`-based:

- `GET /api/onboarding` on fresh store → 200 with `{ completedAt: null }`.
- `POST /api/onboarding/complete` → 200 with `{ completedAt: <number> }`, GET reflects same.
- `POST` twice → idempotent (timestamp updates).
- `POST` on a thrown store → 500 `storage_error`.

**`packages/server/src/__tests__/routes/invite-gate.test.ts`** — extend:

- `GET /api/onboarding` blocked with 403 when not accepted.
- `POST /api/onboarding/complete` blocked with 403 when not accepted.

**`packages/web/src/__tests__/api/client.test.ts`** — extend:

- `getOnboarding` GETs `'api/onboarding'` and parses response.
- `postOnboardingComplete` POSTs `'api/onboarding/complete'` (no body) and parses response.
- 500 storage_error throws ApiError.

**`packages/web/src/__tests__/stores/onboarding.test.ts`** — new file:

- Initial: `completedAt === undefined`, `shouldShowWizard === false` (avoid flash).
- After `loadStatus` resolves with `null`: `completedAt === null`, `shouldShowWizard === true`.
- After `loadStatus` resolves with a number: `completedAt === <number>`, `shouldShowWizard === false`.
- `complete()` happy path: `completedAt` set to result, phase=idle.
- `complete()` failure: phase=error, `completedAt` unchanged (stays null), error stored, throws.

**`packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts`** — new file:

- Renders heading + paragraph + language dropdown (3 options: auto, en, cs).
- Dropdown pre-selected from `settings.effective.language`.
- Picking a language calls `settings.setLanguage`.
- Continue button click emits `continue`.
- Skip link click emits `skip`.

**`packages/web/src/__tests__/components/onboarding/PreviewStep.test.ts`** — new file:

- During analyze loading → renders loading state.
- After analyze success → renders summary line, DashboardPreview, "Show breakdown" `<details>`.
- Clicking "Apply" calls `apply.apply()` with the right config + snapshot.
- Apply error → inline error banner with Retry.
- Analyze error → inline error banner with Retry + Back.
- Back button click emits `back`.
- Skip link click emits `skip`.
- "Show breakdown" toggle reveals RoomList + MiscBucket with `readOnly: true`.

**`packages/web/src/__tests__/components/onboarding/DoneStep.test.ts`** — new file:

- Renders success heading + body.
- "Open dashboard" button calls `window.open` with the right URL (`/lovelace/<urlPath>`).
- "Continue to Lovelacer" button emits `finish`.
- Skip link click emits `skip`.

**`packages/web/src/__tests__/components/OnboardingWizard.test.ts`** — new file:

- Renders WelcomeStep when `currentStep === 'welcome'` (default).
- Continue from WelcomeStep → calls `settings.saveAndReanalyze`, transitions to PreviewStep.
- Apply success on PreviewStep → calls `onboarding.complete`, transitions to DoneStep.
- Apply error on PreviewStep → does NOT call `onboarding.complete`, does NOT transition.
- Skip from any step → calls `onboarding.complete`, then `analyze.analyze` (or `settings.saveAndReanalyze` if dirty).
- If `settings.hasDirty` on Skip → also calls `settings.saveAndReanalyze` first (preserves the language pick).

**`packages/web/src/__tests__/App.test.ts`** — extend:

- Initial render (both invite + onboarding loading) → all three (gate, wizard, main) hidden.
- Invite accepted, onboarding pending → wizard visible, main hidden.
- Invite accepted, onboarding completed → main visible, wizard hidden.
- Invite not accepted → InviteGate visible, neither wizard nor main rendered.

**Read-only prop tests:**

- `RoomList.test.ts`: extend with a test that `readOnly: true` hides the override dropdown (no `<select>` rendered for entities).
- `MiscBucket.test.ts`: extend with a test that `readOnly: true` hides the bulk-select checkboxes + per-row hide toggle + bulk action bar.
- `EntityRow.test.ts`: extend with a test that `readOnly: true` hides the dropdown.

**Manual smoke** (per ROADMAP DoD):

1. Fresh install (clean DB): app loads → invite gate → enter code → wizard appears (no flash, smooth transition).
2. WelcomeStep: pick `English`, click Continue → loading spinner morphs into PreviewStep.
3. PreviewStep: see summary + DashboardPreview. Click "Show breakdown" → RoomList + MiscBucket appear in read-only form. Click Apply → success → DoneStep appears.
4. DoneStep: "Open dashboard" opens HA's dashboard URL in a new tab. "Continue to Lovelacer" → wizard unmounts, main app appears, fully populated.
5. Refresh the page: wizard does NOT re-appear (`completedAt` set).
6. Skip flow (separate fresh install): WelcomeStep → click Skip → wizard disappears immediately, main app appears with `analyze.preview` populated.
7. Skip after picking a language: WelcomeStep → pick `Čeština` → click Skip → main app appears, opening Settings shows `Čeština` selected (skip preserved the pick).
8. Apply error during wizard: simulate HA disconnect, click Apply → error banner inline. Reconnect, click Retry → success → DoneStep.

## File summary

**New:**

- `packages/server/src/storage/onboarding-store.ts`
- `packages/server/src/storage/__tests__/onboarding-store.test.ts`
- `packages/server/src/routes/onboarding.ts`
- `packages/server/src/__tests__/routes/onboarding.test.ts`
- `packages/web/src/stores/onboarding.ts`
- `packages/web/src/__tests__/stores/onboarding.test.ts`
- `packages/web/src/components/OnboardingWizard.vue`
- `packages/web/src/__tests__/components/OnboardingWizard.test.ts`
- `packages/web/src/components/onboarding/WelcomeStep.vue`
- `packages/web/src/components/onboarding/PreviewStep.vue`
- `packages/web/src/components/onboarding/DoneStep.vue`
- `packages/web/src/components/onboarding/ProgressDots.vue`
- `packages/web/src/__tests__/components/onboarding/WelcomeStep.test.ts`
- `packages/web/src/__tests__/components/onboarding/PreviewStep.test.ts`
- `packages/web/src/__tests__/components/onboarding/DoneStep.test.ts`

**Modified:**

- `packages/server/src/app.ts` — register `onboardingRoute`, add `onboarding` to `CreateAppOptions`.
- `packages/server/src/main.ts` — instantiate + close `OnboardingStore`.
- `packages/server/src/__tests__/routes/invite-gate.test.ts` — extend with onboarding gating tests + pass new store into `makeApp`.
- `packages/server/src/__tests__/routes/preview.test.ts` — pass new store into `makeApp` (similar adjustment to other createApp call sites).
- `packages/server/src/__tests__/routes/analyze.test.ts` — same.
- `packages/server/src/__tests__/routes/apply.test.ts` — same.
- `packages/server/src/__tests__/routes/export.test.ts` — same.
- `packages/server/src/__tests__/pipeline.test.ts` — pipeline tests don't need it; createApp tests do.
- `packages/web/src/api/types.ts` — add `OnboardingStatus` type.
- `packages/web/src/api/client.ts` — `getOnboarding`, `postOnboardingComplete`.
- `packages/web/src/__tests__/api/client.test.ts` — extend with onboarding client tests.
- `packages/web/src/components/RoomList.vue` — add `readOnly?: boolean` prop, conditionally hide override dropdowns.
- `packages/web/src/components/EntityRow.vue` — add `readOnly?: boolean` prop, conditionally hide dropdown.
- `packages/web/src/components/MiscBucket.vue` — add `readOnly?: boolean` prop, conditionally hide bulk controls.
- `packages/web/src/__tests__/components/RoomList.test.ts` — extend with read-only test.
- `packages/web/src/__tests__/components/MiscBucket.test.ts` — extend with read-only test.
- `packages/web/src/__tests__/components/EntityRow.test.ts` — extend with read-only test.
- `packages/web/src/App.vue` — gate showWizard / showMainView, mount-time onboarding.loadStatus, render `<OnboardingWizard>`.
- `packages/web/src/__tests__/App.test.ts` — extend with three-view-state tests.

## Out of scope (deferred)

- **Re-running the wizard later** (e.g., from settings). Once `completedAt` is set, the wizard never re-shows. Users can change language via the Settings modal landed in P2-6. A "Re-run onboarding" button is a future enhancement if user feedback warrants it.
- **Wizard state recovery after browser refresh mid-flow.** If the user is on PreviewStep and refreshes, they restart at WelcomeStep (since wizard internal step state is component-local, not persisted). Acceptable for an M-sized ticket — the wizard is short enough to redo. A future enhancement could persist `currentStep` via sessionStorage.
- **Multi-step language preview** (e.g., showing "X entities matched in EN, Y in CS"). Auto vs specific is a binary pick today; a richer UX comparing detection coverage across languages is its own feature.
- **Animated step transitions.** Steps swap via `v-if` with no transition. Adding Vue's `<Transition>` wrapper is polish for P3.
- **Loading indicators between renders.** A small spinner during the initial load of `invite.loadStatus` + `onboarding.loadStatus` could replace the blank page. Today the loads complete in milliseconds; a spinner is unneeded. P3 polish if user feedback says otherwise.
- **First-time analyze error explainer.** If the user's first Analyze hits a stumbling block (HA disconnected, no entities), a more nuanced error message ("Looks like Home Assistant has no entities yet — set up some integrations and come back!") would help. The current error UI is technically functional. P3 polish.
- **Editing during the wizard's Preview step.** The wizard is read-only — overrides require leaving the wizard via Apply (which respects the auto-detected room assignments) or the Skip path (which lands on the editable main view). Letting users edit during the wizard would essentially make the wizard the regular app view; that's not the wizard's purpose.
- **Welcome screen marketing.** A nicer landing screen with feature highlights, screenshots, etc. is part of P2-8 (logo, screenshots, README). The current welcome screen is functional but minimal.
