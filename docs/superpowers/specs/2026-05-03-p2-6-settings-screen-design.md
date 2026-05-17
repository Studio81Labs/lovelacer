# P2-6 — Settings Screen — Design

**Status:** Draft v1 · **Date:** 2026-05-03 · **Phase:** 2 (Polish & Release) · **Sizing:** S

## Goal

Surface three add-on options in the SPA so users can adjust them without restarting the add-on or editing Supervisor config: **detection language**, **card pack** (UI placeholder for a future ticket), and **home-view sections**. Settings persist via SQLite, take effect on the next analyze, and default to behavior-preserving values so existing installs see no change until they open the modal.

**Acceptance criteria** (from ROADMAP.md):

- Changing language and re-analyzing changes detection.
- Setting persists.
- Backend re-reads on change.

## Context

Phase 2 ticket 6. Phase 2 has shipped P2-1 (re-analysis diff view), P2-2 (YAML export), P2-3 (floor-aware grouping), P2-4 (misc bucket bulk UX), and P2-5 (suggestions panel). Sizing per ROADMAP: S (~1-2 evenings).

The detector currently calls `findRoom(name)` without a language filter — so it matches all keyword sets simultaneously (today only EN+CS have data). Making language user-selectable is a small plumbing change but a real behavior change, so the default `'auto'` preserves today's multilingual behavior. Card pack does not exist as an abstraction yet; this ticket ships only the UI dropdown and persists the value, with a single `'default'` option. Section toggles map cleanly onto the seven conditional builders already in `buildHomeView` (Welcome, QuickStats, People, RoomsByFloor, ActiveRooms, Scenes, Cameras).

Persistence mirrors the established `InviteStore` / `AppliedSnapshotStore` single-row pattern. The settings UI is a modal launched from a header gear icon — no Vue Router needed (the SPA has none today). Save triggers an automatic re-analyze, mirroring `OverridesBar.saveAndReanalyze` so users see the effect of their change immediately.

## Architecture & data flow

Five pieces:

1. **`Settings` shape + `DEFAULT_SETTINGS`** in `@lovelacer/shared`. New `SettingsLanguage` / `SettingsCardPack` / `SettingsSections` types and a `SUPPORTED_LANGUAGES` exported `as const` tuple so the route's Zod enum derives from a single source of truth.

2. **`SettingsStore` SQLite single-row table** (`packages/server/src/storage/settings-store.ts`). Mirrors `InviteStore` / `AppliedSnapshotStore`. JSON payload column for forward-compatible field additions. `get()` returns `DEFAULT_SETTINGS` on missing-or-corrupt row.

3. **Server pipeline + new endpoints** (`packages/server/src/pipeline.ts` + `packages/server/src/routes/settings.ts`):
   - `runFullPipeline` reads settings once, threads `language` into `detect()` and surfaces section flags via a new `PipelineState.sectionFlags`.
   - `runPreview` passes `sectionFlags` into `buildHomeView`.
   - New `GET /api/settings` and `PUT /api/settings` endpoints with Zod-validated body.

4. **Detector + generator changes**:
   - `@lovelacer/analyzer`: `DetectInput.language?: LanguageCode` plumbed into priorities 3-5 (`findRoom` calls). Priorities 1-2 (entity_area, device_area) stay multilingual — HA's registry data is what it is.
   - `@lovelacer/generator`: `BuildHomeViewInput.sections: SettingsSections` plumbed into the seven section builders as a top-level guard.

5. **Frontend**:
   - Type mirror in `packages/web/src/api/types.ts`.
   - `getSettings` / `putSettings` API client functions.
   - `useSettingsStore` Pinia store with serverState/dirtyState/effective shape mirroring `useOverridesStore`. Exposes `saveAndReanalyze` that PUTs and then triggers `analyze.analyze()`.
   - `SettingsModal.vue` — fixed-position overlay with header, body (3 setting groups), footer (Discard / Save & re-analyze). Dirty-guard: backdrop click is no-op while `hasDirty === true`.
   - `App.vue` adds a gear button next to the header that opens the modal.

## Settings shape and defaults

```ts
// @lovelacer/shared

export const SUPPORTED_LANGUAGES = ['auto', 'en', 'cs'] as const
export type SettingsLanguage = (typeof SUPPORTED_LANGUAGES)[number]

export const SUPPORTED_CARD_PACKS = ['default'] as const
export type SettingsCardPack = (typeof SUPPORTED_CARD_PACKS)[number]

export interface SettingsSections {
  welcome: boolean
  quickStats: boolean
  people: boolean
  roomsByFloor: boolean
  activeRooms: boolean
  scenes: boolean
  cameras: boolean
}

export interface Settings {
  /**
   * Detection language for name-based matching and generated room titles.
   * `'auto'` matches all available keyword sets simultaneously and preserves
   * HA area names for room titles when available. Specific languages narrow
   * the matcher to that set's keywords and use localized canonical room names
   * for generated titles; priorities 1-2 stay multilingual for assignment.
   */
  language: SettingsLanguage

  /**
   * Card-style pack for the generator. Stub for a future ticket — only
   * `'default'` is shipped today. Persisted but the generator currently
   * ignores the value.
   */
  cardPack: SettingsCardPack

  /** Per-section toggles for the home view's seven conditional builders. */
  sections: SettingsSections
}

export const DEFAULT_SETTINGS: Settings = {
  language: 'auto',
  cardPack: 'default',
  sections: {
    welcome: true,
    quickStats: true,
    people: true,
    roomsByFloor: true,
    activeRooms: true,
    scenes: true,
    cameras: true,
  },
}
```

**Defaults preserve every current behavior.** A user who installs P2-6 and never opens the modal sees zero change.

**Language UI** shows only languages with shipped keyword data: `Auto`, `English`, `Čeština`. The other six entries in the analyzer's `LanguageCode` union (DE/ES/FR/IT/PL/NL) are reserved for future tickets and are absent from `SUPPORTED_LANGUAGES`.

## SettingsStore

`packages/server/src/storage/settings-store.ts`:

```sql
CREATE TABLE IF NOT EXISTS settings (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  payload     TEXT    NOT NULL,
  updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
);
```

Single-row table (CHECK id=1) — only the most recent settings retained. Store is the trust boundary; the route's Zod schema validates incoming bodies.

```ts
export class SettingsStore {
  constructor(filename: string)
  /** Returns DEFAULT_SETTINGS if no row exists or the row's JSON is malformed. */
  get(): Settings
  /** INSERT OR REPLACE — atomic. */
  save(settings: Settings): void
  close(): void
}
```

`get()` parses `payload` JSON and validates the parsed value against the `Settings` shape (hand-rolled type guard — small fixed shape, avoids dragging zod into the server's storage layer). On parse failure or shape-mismatch, logs a warning and returns `DEFAULT_SETTINGS` — defense-in-depth so a bad row never crashes startup.

Constructor accepts `':memory:'` for tests, otherwise creates parent dir via `mkdirSync(dirname, { recursive: true })`. Pragma `journal_mode = WAL`. Prepared statements (stmtGet, stmtSave) hoisted in the constructor.

`main.ts` instantiates the store at the same SQLite file path as the others (`config.dataDir + '/lovelacer.sqlite'`), passes it to `createApp`, closes on shutdown.

## API + persistence wiring

**Pipeline change** in `runFullPipeline`:

```ts
async function runFullPipeline(
  ha: HaClient,
  overrides: OverrideStore,
  settings: SettingsStore,
): Promise<PipelineState> {
  const cfg = settings.get()

  // ...existing registry fetches unchanged...

  const entities = normalize({ entities: entityRegistry, devices: deviceRegistry })
  const detectLanguage = cfg.language === 'auto' ? undefined : cfg.language
  const assignments = detect({ entities, areas: areaRegistry, language: detectLanguage })

  // ...rest unchanged through groupings/rooms/misc/floorAssignments...

  return {
    ...existing,
    sectionFlags: cfg.sections,
  }
}
```

`PipelineState` adds `sectionFlags: SettingsSections`. `runPreview` passes it into `buildHomeView({ ...existing, sections: state.sectionFlags })`. `runApply`'s body-config path skips `runPreview` so settings aren't read in that branch — the persisted YAML matches what was previewed.

**`GET /api/settings`** — returns `{ settings: Settings }`. Returns `DEFAULT_SETTINGS` if no row exists.

**`PUT /api/settings`** — body `{ settings: Settings }`, full replace. Returns `{ settings: Settings }` (the persisted state, mirroring `PUT /api/overrides`).

```ts
const SectionsSchema = z.object({
  welcome: z.boolean(),
  quickStats: z.boolean(),
  people: z.boolean(),
  roomsByFloor: z.boolean(),
  activeRooms: z.boolean(),
  scenes: z.boolean(),
  cameras: z.boolean(),
})

const PutBodySchema = z.object({
  settings: z.object({
    language: z.enum(SUPPORTED_LANGUAGES),
    cardPack: z.enum(SUPPORTED_CARD_PACKS),
    sections: SectionsSchema,
  }),
})
```

Errors: `400 invalid_body` on schema failure, `500 storage_error` on DB throw.

`CreateAppOptions.settings: SettingsStore` is added. `previewRoute` and `applyRoute` option interfaces gain `settings`. The route is registered between `overridesRoute` and `suggestionsRoute` in `app.ts`. Invite gate (P1b-6) covers `/api/settings` automatically; one new test in `invite-gate.test.ts` pins the contract.

## Detector and generator changes

**`@lovelacer/analyzer`** — small additive change:

```ts
export interface DetectInput {
  entities: NormalizedEntity[]
  areas: HaAreaRegistryEntry[]
  /** P2-6 — narrow priorities 3-5 to this language. Undefined = match all. */
  language?: LanguageCode
}
```

`detectEntity`'s priority 3 (friendly_name), priority 4 (entity_id), and priority 5 (device_name) call `findRoom(value, { language: ctx.language })`. The detection context grows a `language?: LanguageCode` field forwarded from `DetectInput`. Priorities 1-2 (`buildDetectionContext` + entity_area + device_area) stay multilingual — area names from HA's registry are matched against all keyword sets, regardless of the user's language pick. Document this asymmetry inline.

No changes to existing detect tests' baseline behavior — calls without `language` continue to match-all.

**`@lovelacer/generator`** — add per-section guards:

```ts
export interface BuildHomeViewInput {
  entities: NormalizedEntity[]
  groupings: RoomGrouping[]
  rooms: AnalyzedRoom[]
  floorAssignments: Map<CanonicalRoomId, FloorAssignment | null>
  sections: SettingsSections // NEW
}

// inside buildHomeView:
const sections: GridSection[] = []

if (input.sections.welcome) {
  sections.push(buildWelcomeSection(input.entities))
}
if (input.sections.quickStats) {
  const qs = buildQuickStatsSection(input.entities)
  if (qs !== null) sections.push(qs)
}
// ...same pattern for People, RoomsByFloor, ActiveRooms, Scenes, Cameras
```

Empty `sections` array is valid — `buildHomeView` returns a `HomeView` with `sections: []` if all toggles are off. HA renders an empty home view (ugly but not crashing).

## Frontend

**Type mirror** in `packages/web/src/api/types.ts`:

```ts
export type SettingsLanguage = 'auto' | 'en' | 'cs'
export type SettingsCardPack = 'default'

export interface SettingsSections {
  welcome: boolean
  quickStats: boolean
  people: boolean
  roomsByFloor: boolean
  activeRooms: boolean
  scenes: boolean
  cameras: boolean
}

export interface Settings {
  language: SettingsLanguage
  cardPack: SettingsCardPack
  sections: SettingsSections
}
```

Mirrored locally per the web package's zero-shared-deps convention.

**API client** (`packages/web/src/api/client.ts`):

```ts
export function getSettings(): Promise<{ settings: Settings }> {
  return fetchJson('api/settings')
}

export function putSettings(body: { settings: Settings }): Promise<{ settings: Settings }> {
  return fetchJson('api/settings', {
    method: 'PUT',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}
```

Document-relative URLs (`'api/settings'`) for HA add-on ingress compatibility.

**`useSettingsStore`** (`packages/web/src/stores/settings.ts`):

Mirrors `useOverridesStore`'s staging pattern:

```ts
export const useSettingsStore = defineStore('settings', () => {
  const phase = ref<'idle' | 'loading' | 'saving' | 'error'>('idle')
  const error = ref<ApiError | null>(null)
  const serverState = ref<Settings | null>(null)
  const dirtyState = ref<Settings | null>(null)

  const hasDirty = computed(() => dirtyState.value !== null)
  const effective = computed<Settings>(
    () => dirtyState.value ?? serverState.value ?? DEFAULT_SETTINGS,
  )

  function setLanguage(lang: SettingsLanguage): void {
    /* clone effective into dirty, set field */
  }
  function setCardPack(pack: SettingsCardPack): void {
    /* same pattern */
  }
  function setSection(name: keyof SettingsSections, value: boolean): void {
    /* same pattern */
  }
  function discardChanges(): void {
    dirtyState.value = null
  }

  async function loadFromServer(): Promise<void> {
    /* GET, set serverState, clear dirty */
  }

  async function saveAndReanalyze(): Promise<void> {
    // PUT effective settings, replace serverState with response, clear dirty,
    // then call useAnalyzeStore().analyze() — mirrors useOverridesStore.
    // PUT errors leave dirtyState intact for retry.
  }

  return {
    phase,
    error,
    serverState,
    dirtyState,
    hasDirty,
    effective,
    setLanguage,
    setCardPack,
    setSection,
    discardChanges,
    loadFromServer,
    saveAndReanalyze,
  }
})
```

`DEFAULT_SETTINGS` is duplicated here to keep web isolated from `@lovelacer/shared` — same pattern Override widening uses.

**`SettingsModal.vue`** — fixed-position overlay similar to `InviteGate.vue`:

```vue
<template>
  <div
    data-testid="settings-modal-backdrop"
    class="fixed inset-0 z-40 bg-stone-900/40"
    @click="onBackdropClick"
  >
    <div
      data-testid="settings-modal"
      class="mx-auto mt-20 max-w-md rounded-lg bg-white p-5 shadow-xl"
      @click.stop
    >
      <header class="mb-4 flex items-center justify-between">
        <h2 class="text-lg font-medium">Settings</h2>
        <button data-testid="settings-close" aria-label="Close" @click="emit('close')">×</button>
      </header>

      <section class="space-y-4">
        <!-- Language -->
        <label>
          <span class="block text-sm font-medium text-stone-700">Detection language</span>
          <select
            data-testid="settings-language"
            :value="store.effective.language"
            @change="store.setLanguage(($event.target as HTMLSelectElement).value as SettingsLanguage)"
          >
            <option value="auto">Auto (match all)</option>
            <option value="en">English</option>
            <option value="cs">Čeština</option>
          </select>
        </label>

        <!-- Card pack -->
        <label>
          <span class="block text-sm font-medium text-stone-700">Card pack</span>
          <select data-testid="settings-card-pack" :value="store.effective.cardPack" disabled>
            <option value="default">Default</option>
          </select>
          <p class="text-xs text-stone-500">More packs coming soon.</p>
        </label>

        <!-- Sections -->
        <fieldset>
          <legend class="text-sm font-medium text-stone-700">Home view sections</legend>
          <label v-for="key in SECTION_KEYS" :key="key" class="flex items-center gap-2">
            <input
              type="checkbox"
              :data-testid="`settings-section-${key}`"
              :checked="store.effective.sections[key]"
              @change="store.setSection(key, ($event.target as HTMLInputElement).checked)"
            />
            <span>{{ SECTION_LABELS[key] }}</span>
          </label>
        </fieldset>
      </section>

      <footer class="mt-5 flex justify-end gap-2">
        <button
          v-if="store.hasDirty"
          data-testid="settings-discard"
          class="rounded border border-stone-300 px-3 py-1"
          @click="store.discardChanges"
        >
          Discard changes
        </button>
        <button
          data-testid="settings-save"
          class="rounded bg-brand-600 px-3 py-1 text-white disabled:opacity-50"
          :disabled="!store.hasDirty || store.phase === 'saving'"
          @click="onSave"
        >
          Save & re-analyze
        </button>
      </footer>
    </div>
  </div>
</template>
```

`onBackdropClick` no-ops when `store.hasDirty === true` (silent dirty guard — protects edits without a confirm dialog). Otherwise emits `close`. `onSave` calls `store.saveAndReanalyze()` then `emit('close')` on success; on error keeps the modal open with `dirtyState` preserved for retry.

**App.vue wiring:**

- Add a `<button data-testid="settings-button" aria-label="Settings">⚙</button>` next to the existing `Lovelacer` heading or in a small toolbar row.
- New ref `const settingsOpen = ref(false)`.
- Click handler: `settings.loadFromServer(); settingsOpen.value = true`.
- Render `<SettingsModal v-if="settingsOpen" @close="settingsOpen = false" />`.

The existing `analyze.analyze()` flow handles the post-save view update — settings store doesn't need its own watch on preview.

## Edge cases and error handling

- **Settings row absent on first request.** `SettingsStore.get()` returns `DEFAULT_SETTINGS`. `runFullPipeline` reads it, language is `'auto'`, all sections on — exactly today's behavior. New users never see a difference until they open the modal.
- **JSON parse failure on stored row** (corrupt write, schema drift from a downgrade). `SettingsStore.get()` catches `SyntaxError` / shape mismatch, logs a warning, returns `DEFAULT_SETTINGS`. The next `save()` overwrites the bad row.
- **User picks language `'cs'` but their HA registry has English area names.** Priorities 1-2 (entity_area, device_area) keep matching multilingually, so existing area_id mappings still work. Only priorities 3-5 (friendly_name, entity_id, device_name) narrow to CS. Detection quality drops only for entities relying purely on name signals — which is the user's own choice.
- **All 7 sections turned off.** `buildHomeView` returns a valid `HomeView` with `sections: []`. HA renders an empty home view — ugly but valid. No "minimum 1 section" rule.
- **Save fails (500 storage_error).** Store stays in `phase: 'error'`, modal shows error banner with `Retry` button. `dirtyState` preserved so the user doesn't lose edits.
- **User changes settings then closes modal without saving.** Backdrop click is no-op when `hasDirty === true`. User must explicitly `Discard changes` or `Save & re-analyze`.
- **Re-analyze fails after save.** Settings are already persisted (PUT succeeded). The analyze store handles its own error path; settings store is `idle` regardless. User sees the analyze error UI in App.vue.
- **Concurrent saves from two tabs.** SQLite single-writer + INSERT OR REPLACE means last-write-wins. Acceptable for single-tenant add-on.
- **Apply (P1a-8) called with `body.config` set.** `runApply` skips `runPreview` in that path → settings aren't read. The persisted YAML matches what was previewed at build time. No drift.
- **Diff (P2-1).** Section toggles change the home view, not entity assignments. Diff stays accurate (it operates on `SnapshotAssignment[]`, not the home view).
- **YAML export (P2-2).** `runPreview` produces the config, `configToYaml` serializes. With section toggles applied, the exported YAML reflects the user's choices.
- **Suggestions (P2-5).** Independent layer. Settings don't affect the suggestion engine.

## Testing strategy

**`packages/server/src/storage/__tests__/settings-store.test.ts`** — `:memory:` DB:

- Empty store → `get()` returns `DEFAULT_SETTINGS`.
- `save(s)` then `get()` returns the saved settings.
- `save` twice with different shapes → second wins (idempotent INSERT OR REPLACE).
- File-backed: persists across instances.
- Corrupt row (manually inject malformed JSON) → `get()` returns defaults.
- File-backed test creates parent dir if missing.

**`packages/server/src/__tests__/routes/settings.test.ts`** — `app.inject`-based:

- `GET /api/settings` on fresh store → 200 with `DEFAULT_SETTINGS`.
- `PUT /api/settings` with valid body → 200, returns persisted settings, store has the row.
- `PUT` with invalid language ('xx') → 400 `invalid_body`.
- `PUT` with missing `sections.welcome` → 400 `invalid_body`.
- Round-trip: PUT then GET returns same shape.

**`packages/server/src/__tests__/routes/invite-gate.test.ts`** — extend:

- `GET /api/settings` blocked with 403 when not accepted.
- `PUT /api/settings` blocked with 403 when not accepted.

**`packages/server/src/__tests__/routes/preview.test.ts`** — extend:

- Default settings → home view contains all 7 sections (when fixture entities support them).
- Save settings with `sections.scenes: false` → re-preview → home view does NOT contain a "Scenes" section.
- Save settings with `language: 'cs'` → fixture with English-only friendly names sees fewer name-based detections than `'auto'` baseline.

**`packages/analyzer/src/__tests__/detect.test.ts`** — extend:

- `detect({..., language: 'cs'})` filters priorities 3-5 to CS keywords only — entity with English-only friendly name → not matched at priority 3.
- `detect({..., language: 'cs'})` with HA area name matching English → priority 1 still fires (multilingual).
- `detect({..., language: undefined})` matches as today (regression guard).

**`packages/generator/src/__tests__/home-view.test.ts`** — extend:

- `buildHomeView({..., sections: { welcome: false, ...rest true }})` → returned `sections` array does NOT include the welcome card.
- `buildHomeView({..., sections: all-false})` → returned `HomeView` has empty sections array, but is still a valid `HomeView` shape.

**`packages/web/src/__tests__/api/client.test.ts`** — extend:

- `getSettings` GETs to `'api/settings'` and parses response.
- `putSettings` PUTs to `'api/settings'` with body, parses response.
- 400 invalid_body throws `ApiError`.

**`packages/web/src/__tests__/stores/settings.test.ts`** — new file:

- Initial state: `phase=idle`, `serverState=null`, `dirtyState=null`, `effective=DEFAULT_SETTINGS`.
- `loadFromServer` happy path: serverState populated, phase=idle.
- `setLanguage('cs')` → dirtyState diverges, hasDirty=true, effective reflects 'cs'.
- `discardChanges` clears dirtyState.
- `saveAndReanalyze` happy path: PUT, serverState replaced, dirtyState cleared, `analyze.analyze` called.
- `saveAndReanalyze` failure: phase=error, dirtyState preserved.

**`packages/web/src/__tests__/components/SettingsModal.test.ts`** — new file:

- Renders all 3 setting groups (language, cardPack, sections).
- Language dropdown shows Auto/English/Čeština.
- Card pack dropdown disabled or shows "Default" only.
- 7 section checkboxes render with correct labels.
- Toggling a checkbox updates `dirtyState`.
- Save button disabled when not dirty or while saving.
- Save button click triggers `store.saveAndReanalyze` and emits `close` on success.
- Discard button click clears dirty state.
- Backdrop click while dirty does NOT emit close.
- Backdrop click while not dirty DOES emit close.

**`packages/web/src/__tests__/App.test.ts`** — extend:

- Settings gear button renders.
- Click opens the modal (settingsOpen ref toggled).

**Manual smoke** (per ROADMAP DoD):

1. Default install: open the SPA, click ⚙ → modal shows Auto language, Default card pack, all 7 sections checked.
2. Pick `English`, uncheck `Cameras`, click `Save & re-analyze` → modal closes, view re-analyzes, the home view in DashboardPreview no longer contains a Cameras section.
3. Open ⚙ again → English + cameras off persist. Restart the server (`Ctrl+C`, then re-run `pnpm dev`) → re-analyze → still persist (DB).
4. Pick `Čeština` on a fixture with English friendly names → re-analyze → some detections drop or move to misc (validates language wiring).
5. Open ⚙, change something, click backdrop → modal stays open (dirty guard). Click `Discard changes` → dirty cleared. Click backdrop → modal closes.

## File summary

**New:**

- `packages/server/src/storage/settings-store.ts`
- `packages/server/src/storage/__tests__/settings-store.test.ts`
- `packages/server/src/routes/settings.ts`
- `packages/server/src/__tests__/routes/settings.test.ts`
- `packages/web/src/stores/settings.ts`
- `packages/web/src/__tests__/stores/settings.test.ts`
- `packages/web/src/components/SettingsModal.vue`
- `packages/web/src/__tests__/components/SettingsModal.test.ts`

**Modified:**

- `packages/shared/src/types.ts` — add `SUPPORTED_LANGUAGES`, `SUPPORTED_CARD_PACKS`, `SettingsLanguage`, `SettingsCardPack`, `SettingsSections`, `Settings`, `DEFAULT_SETTINGS`.
- `packages/analyzer/src/detect.ts` — `DetectInput.language?`, `DetectionContext.language?`, plumb into priorities 3-5.
- `packages/analyzer/src/__tests__/detect.test.ts` — extend with language-filter coverage.
- `packages/generator/src/home-view.ts` — `BuildHomeViewInput.sections`, per-section guards.
- `packages/generator/src/__tests__/home-view.test.ts` — extend with section-toggle coverage.
- `packages/server/src/pipeline.ts` — `runFullPipeline` reads settings, threads language to detect, surfaces sectionFlags. `PipelineState.sectionFlags`. `runPreview` passes sections to buildHomeView. `runApply` accepts settings (no internal use beyond runPreview chain).
- `packages/server/src/app.ts` — register `settingsRoute`, add `settings` to `CreateAppOptions`, plumb to `previewRoute` / `applyRoute`.
- `packages/server/src/main.ts` — instantiate + close `SettingsStore`.
- `packages/server/src/routes/preview.ts` — accept `settings` option, pass to `runPreview`.
- `packages/server/src/routes/apply.ts` — accept `settings` option, pass to `runApply`.
- `packages/server/src/routes/export.ts` — accept `settings` option, pass to `runPreview`.
- `packages/server/src/__tests__/routes/preview.test.ts` — extend with section + language test cases (and pass new store into `makeApp`).
- `packages/server/src/__tests__/routes/invite-gate.test.ts` — extend with `GET/PUT /api/settings` 403 cases (and pass new store into `makeApp`).
- `packages/web/src/api/types.ts` — mirror `Settings` types.
- `packages/web/src/api/client.ts` — `getSettings`, `putSettings`.
- `packages/web/src/__tests__/api/client.test.ts` — extend with settings client tests.
- `packages/web/src/App.vue` — render gear button + `SettingsModal`.

## Out of scope (deferred)

- **Card pack implementation.** Today's design ships only the UI dropdown with `'default'`. Adding alternative packs (tile-pack, glance-pack, picture-pack, etc.) is its own ticket — needs new abstractions in `@lovelacer/generator` for swappable card emitters.
- **More languages.** DE/ES/FR/IT/PL/NL show in `LanguageCode` but lack keyword data. Each language is its own ticket (data + ICU normalization + tests).
- **Per-section configuration** (e.g., "max scenes shown", "include cameras with motion only"). The lite version exposes only on/off toggles.
- **Settings exposed via Supervisor add-on options.** Today only `log_level` and `dashboard_url_path` come from `/data/options.json`. Surfacing the new settings to Supervisor requires `apps/addon/config.yaml` schema changes and a sync mechanism — not needed when our own UI persists them in SQLite.
- **Language auto-detection from HA's user locale.** A future enhancement could read `user.language` via WebSocket and prefill `auto` to a specific match. Today's `'auto'` simply matches all keyword sets, which is good enough.
- **Toast notification on successful save.** Modal close is the success signal; an explicit toast is P3 polish.
- **Watching settings for live propagation across browser tabs.** Two-tab edits collapse to last-write-wins via SQLite. Tab A's edits don't push to tab B until tab B reloads — acceptable for single-user add-on.
