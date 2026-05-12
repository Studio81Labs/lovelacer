# Room Drag Order Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add persisted user-controlled room ordering with drag support in the room list.

**Architecture:** Store the preference as `Settings.roomOrder?: string[]`, validate it through the existing settings route and storage guard, and apply it at the web component boundary. `RoomList` owns drag interactions and emits `reorder` with a complete room-id list; `App.vue` persists through the existing settings store.

**Tech Stack:** TypeScript, Vue 3, Pinia, Fastify, Zod, Vitest, Vue Test Utils.

---

### Task 1: Persist Settings Shape

**Files:**

- Modify: `packages/shared/src/types.ts`
- Modify: `packages/web/src/api/types.ts`
- Modify: `packages/server/src/storage/settings-store.ts`
- Modify: `packages/server/src/routes/settings.ts`
- Test: `packages/server/src/storage/__tests__/settings-store.test.ts`
- Test: `packages/server/src/__tests__/routes/settings.test.ts`

- [ ] **Step 1: Write failing storage and route tests**

Add tests that save/round-trip `{ ...DEFAULT_SETTINGS, roomOrder: ['bedroom', 'kitchen'] }`, verify legacy rows omit the field, and verify a PUT with `roomOrder: [123]` returns `400 invalid_body`.

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm --filter @lovelacer/server test -- settings-store routes/settings`

Expected: failures because `roomOrder` is not in the Settings type/schema/guard.

- [ ] **Step 3: Implement settings field**

Add `roomOrder?: string[]` to shared and web `Settings`; clone it in the web settings store; validate it in Zod as an optional string array; validate it in `SettingsStore.isSettings`; preserve it conditionally when building the route's persisted settings object.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm --filter @lovelacer/server test -- settings-store routes/settings`

Expected: PASS.

### Task 2: Render Ordered, Draggable Rooms

**Files:**

- Modify: `packages/web/src/components/RoomList.vue`
- Test: `packages/web/src/__tests__/components/RoomList.test.ts`
- Modify: `packages/web/src/locales/en.json`
- Modify: `packages/web/src/locales/cs.json`
- Modify: `packages/web/src/locales/de.json`

- [ ] **Step 1: Write failing component tests**

Add tests for `roomOrder` ordering, appending unknown rooms alphabetically, emitting `reorder` after drag/drop, and disabling drag while search is active.

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm --filter @lovelacer/web test -- RoomList`

Expected: failures because `RoomList` has no `roomOrder` prop, drag UI, or event.

- [ ] **Step 3: Implement component behavior**

Add `roomOrder?: string[]`; compute `orderedRooms` from `filteredRooms` when searching and from a helper when not searching; add draggable handle buttons; emit `reorder` on drop; add localized drag labels.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm --filter @lovelacer/web test -- RoomList`

Expected: PASS.

### Task 3: Wire App Persistence

**Files:**

- Modify: `packages/web/src/stores/settings.ts`
- Test: `packages/web/src/__tests__/stores/settings.test.ts`
- Modify: `packages/web/src/App.vue`
- Test: `packages/web/src/__tests__/App.test.ts`

- [ ] **Step 1: Write failing store/app tests**

Add a store test for `setRoomOrder()` staging the array and an app test that receives `RoomList` reorder and calls `putSettings` with the new order.

- [ ] **Step 2: Run tests to verify red**

Run: `pnpm --filter @lovelacer/web test -- stores/settings App`

Expected: failures because the store helper and app handler do not exist.

- [ ] **Step 3: Implement wiring**

Add `setRoomOrder(roomIds: string[])` to the settings store, pass `settings.effective.roomOrder` into `RoomList`, and handle `@reorder` by saving settings and reanalyzing.

- [ ] **Step 4: Run tests to verify green**

Run: `pnpm --filter @lovelacer/web test -- stores/settings App`

Expected: PASS.

### Task 4: Final Verification

**Files:**

- All changed files.

- [ ] **Step 1: Typecheck**

Run: `pnpm typecheck`

Expected: PASS.

- [ ] **Step 2: Focused tests**

Run: `pnpm --filter @lovelacer/server test -- settings-store routes/settings && pnpm --filter @lovelacer/web test -- RoomList stores/settings App`

Expected: PASS.

- [ ] **Step 3: Review diff**

Run: `git diff --check && git diff --stat`

Expected: no whitespace errors and a focused diff.
