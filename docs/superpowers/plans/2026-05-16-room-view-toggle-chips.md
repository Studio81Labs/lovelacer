# Room View Toggle Chips Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Persist room dashboard visibility in room overrides and expose it as toggle chips in the dashboard preview.

**Architecture:** Add `hiddenFromDashboard?: boolean` to room display overrides across shared/server/web contracts. The server filters hidden rooms before home and room view generation so apply/export/snapshot receive one consistent Lovelace config. The web preview renders all non-Home room candidates as chips, saving the room override and refreshing preview after each toggle.

**Tech Stack:** TypeScript strict mode, Fastify/Zod, SQLite settings JSON, Pinia, Vue 3, Vitest.

---

### Task 1: Settings Contract

**Files:**

- Modify: `packages/shared/src/types.ts`
- Modify: `packages/web/src/api/types.ts`
- Modify: `packages/server/src/routes/settings.ts`
- Modify: `packages/server/src/storage/settings-store.ts`
- Modify: `packages/web/src/stores/settings.ts`
- Test: `packages/server/src/__tests__/routes/settings.test.ts`
- Test: `packages/server/src/storage/__tests__/settings-store.test.ts`
- Test: `packages/web/src/__tests__/stores/settings.test.ts`

- [ ] **Step 1: Write failing settings tests**

  Add tests proving `hiddenFromDashboard` round-trips through the settings route and storage, rejects wrong types, and is preserved by web override sanitization.

- [ ] **Step 2: Run tests to verify RED**

  Run:

  ```bash
  pnpm --filter @lovelacer/server test -- src/__tests__/routes/settings.test.ts src/storage/__tests__/settings-store.test.ts
  pnpm --filter @lovelacer/web test -- src/__tests__/stores/settings.test.ts
  ```

  Expected: failures mention unknown/wrong `hiddenFromDashboard` behavior.

- [ ] **Step 3: Implement contract**

  Extend the mirrored `RoomDisplayOverride` types, Zod schema, storage guard, route normalization, and web settings sanitize/clone paths for `hiddenFromDashboard`.

- [ ] **Step 4: Run tests to verify GREEN**

  Re-run the commands from Step 2. Expected: all pass.

### Task 2: Preview Generation Filtering

**Files:**

- Modify: `packages/server/src/pipeline.ts`
- Test: `packages/server/src/__tests__/pipeline.test.ts`

- [ ] **Step 1: Write failing preview tests**

  Add tests proving hidden rooms are absent from `config.views`, hidden rooms remain in `rooms[]`, Home remains when all rooms are hidden, and Home sections do not link to hidden room paths.

- [ ] **Step 2: Run test to verify RED**

  Run:

  ```bash
  pnpm --filter @lovelacer/server test -- src/__tests__/pipeline.test.ts
  ```

  Expected: tests fail because the pipeline still includes hidden room groupings.

- [ ] **Step 3: Implement filtering**

  Filter dashboard groupings with `state.roomOverrides[roomId]?.hiddenFromDashboard !== true` before `buildHomeView`, `buildRoomViews`, and `buildLovelaceConfig`.

- [ ] **Step 4: Run test to verify GREEN**

  Re-run the command from Step 2. Expected: all pass.

### Task 3: Toggle Chip UI

**Files:**

- Modify: `packages/web/src/components/DashboardPreview.vue`
- Modify: `packages/web/src/App.vue`
- Modify: `packages/web/src/locales/en.json`
- Modify: `packages/web/src/locales/cs.json`
- Modify: `packages/web/src/locales/de.json`
- Test: `packages/web/src/__tests__/components/DashboardPreview.test.ts`
- Test: `packages/web/src/__tests__/App.test.ts`

- [ ] **Step 1: Write failing component tests**

  Update `DashboardPreview` tests for buttons, Home disabled state, inactive hidden chip styling/ARIA, emitted toggle payload, and active-vs-total heading.

- [ ] **Step 2: Run component tests to verify RED**

  Run:

  ```bash
  pnpm --filter @lovelacer/web test -- src/__tests__/components/DashboardPreview.test.ts
  ```

  Expected: tests fail because pills are static list items.

- [ ] **Step 3: Implement component**

  Add props for visible config, all candidate room views, room overrides, and disabled state. Render Home as disabled and rooms as `button` chips with `aria-pressed`; emit `toggle-room-view` for room clicks.

- [ ] **Step 4: Run component tests to verify GREEN**

  Re-run the command from Step 2. Expected: all pass.

- [ ] **Step 5: Write failing App integration test**

  Add a test proving clicking a dashboard preview chip saves the room override and refreshes preview.

- [ ] **Step 6: Run App test to verify RED**

  Run:

  ```bash
  pnpm --filter @lovelacer/web test -- src/__tests__/App.test.ts
  ```

  Expected: the new test fails because `App.vue` does not pass toggle handlers yet.

- [ ] **Step 7: Implement App wiring**

  Compute room-view candidates from `preview.rooms` plus generated view metadata, pass settings state into `DashboardPreview`, and save `hiddenFromDashboard` through `saveRoomOverride` followed by preview refresh.

- [ ] **Step 8: Run App test to verify GREEN**

  Re-run the command from Step 6. Expected: all pass.

### Task 4: Verification

**Files:**

- Review final diff across all touched files.

- [ ] **Step 1: Run targeted suites**

  ```bash
  pnpm --filter @lovelacer/server test -- src/__tests__/routes/settings.test.ts src/storage/__tests__/settings-store.test.ts src/__tests__/pipeline.test.ts
  pnpm --filter @lovelacer/web test -- src/__tests__/stores/settings.test.ts src/__tests__/components/DashboardPreview.test.ts src/__tests__/App.test.ts
  ```

- [ ] **Step 2: Run workspace quality gates**

  ```bash
  pnpm typecheck
  pnpm lint
  pnpm build
  ```

- [ ] **Step 3: Inspect final diff**

  Check for debug leftovers, unrelated formatting churn, stale comments, broken i18n keys, and missed contract updates.
