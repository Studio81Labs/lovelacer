# P1b-6 — Friendly invite flow

**Status:** Design approved 2026-05-02

**Goal:** Closed-beta gating. The Add-on prompts for an invite code on first run; the right code unlocks the full UI, the wrong code shows a polite error. Acceptance persists across restarts. This is the last ticket in Phase 1b before the Closed Beta milestone.

**Out of scope:**

- Real authentication / per-user accounts. Invite codes are a velvet rope, not auth.
- Per-code attribution beyond "which code was used + when" (no analytics, no telemetry pushes).
- Code revocation after acceptance — once a user accepts, their SQLite row keeps them in. Rotating the code list affects new acceptances only.
- Distribution mechanics (DM/email handout). Out-of-band, not part of the addon.

---

## Architecture

A new `InviteStore` parallel to `OverrideStore` (both wrap better-sqlite3 and share `${DATA_DIR}/lovelacer.sqlite`). Plus a Fastify `onRequest` hook that gates the API, two new route handlers, a small frontend `useInviteStore` Pinia store, and a new `InviteGate.vue` modal.

**Module boundaries:**

- `packages/server/src/invite-codes.ts` — exports `ACCEPTED_INVITE_CODES: readonly string[]` plus `isValidInviteCode(code): boolean`. Hardcoded list, rotation = release.
- `packages/server/src/storage/invite-store.ts` — `InviteStore` class (`isAccepted`, `accept`, `close`). Single-row table.
- `packages/server/src/routes/invite.ts` — `GET /api/invite` and `POST /api/invite` route plugin.
- `packages/server/src/app.ts` — gate hook (skips `/api/invite/*` and `/api/health`); registers the route plugin; accepts `invite: InviteStore` in options.
- `packages/server/src/main.ts` — instantiates `InviteStore`, passes to `createApp`, closes in shutdown.
- `packages/web/src/api/client.ts` — `getInvite()` and `postInvite(body)`.
- `packages/web/src/api/types.ts` — extends `ApiError.error` union with `'invite_required' | 'invalid_code'`.
- `packages/web/src/stores/invite.ts` — Pinia store: `accepted`, `phase`, `error`, `loadStatus()`, `submit(code)`.
- `packages/web/src/components/InviteGate.vue` — full-page modal with code input + submit button.
- `packages/web/src/App.vue` — calls `invite.loadStatus()` on mount; renders `<InviteGate>` overlay when `accepted === false`.

**Threat model:** "casual r/homeassistant visitor stumbles onto the addon", not a determined attacker. The codes are in source (open-source repo), so a dedicated reader can self-invite — that's acceptable for closed-beta scope. The gate's primary purpose is to slow casual onboarding so bug reports come from people who got handed a code and read the welcome material.

**Gate semantics:**

- A Fastify `onRequest` hook checks `inviteStore.isAccepted()` for every request whose path starts with `/api/`.
- Returns 403 `{ error: 'invite_required', message: 'Invite code required to continue.' }` UNLESS the path matches `/api/health` or `/api/invite` (with optional trailing path / query string — `startsWith` semantics).
- Once accepted, the hook is effectively a no-op (one prepared `SELECT 1` per request, ~10 µs against a single-row table with WAL mode).

**Code rotation:** edit `ACCEPTED_INVITE_CODES`, ship a release. Existing accepted users keep access (their SQLite row persists across upgrades). New users see only the new list.

```
                   ┌─ POST /api/invite ──→ InviteStore.accept(code)
                   │
                   │   (rest of /api/* gated by onRequest hook)
HA Supervisor ─→ Fastify ─→ Hook checks InviteStore.isAccepted()
                   │              │
                   │              └─ false: 403 invite_required
                   │              └─ true:  pass through
                   │
                   └─ /api/health, /api/invite/*: always allowed
```

---

## Storage + invite-codes module

### Database schema

Single-row table, created on `InviteStore` construction:

```sql
CREATE TABLE IF NOT EXISTS invite_acceptance (
  id          INTEGER PRIMARY KEY CHECK (id = 1),
  code        TEXT NOT NULL,
  accepted_at INTEGER NOT NULL DEFAULT (unixepoch())
);
```

`CHECK (id = 1)` enforces the single-row pattern at SQL level. Acceptance uses `INSERT OR REPLACE` with `id = 1` so re-accept (which shouldn't happen in normal flow) replaces rather than duplicates.

**Why store code + timestamp:** for ~10 invitees, knowing "Alice activated her invite at 2026-05-02" is genuinely useful telemetry. Three columns vs one is trivial overhead, big visibility gain. Operators can `sqlite3 /data/lovelacer.sqlite "SELECT * FROM invite_acceptance"` to see who activated and when.

### `InviteStore` class

The class mirrors `OverrideStore` shape: prepared statements hoisted to constructor, `:memory:` short-circuits `mkdirSync`, WAL mode, schema-on-construct.

Public API:

- `constructor(filename: string)` — accepts `:memory:` for tests; creates parent dir for file paths via `mkdirSync(dirname(filename), { recursive: true })`.
- `isAccepted(): boolean` — returns true if the single row exists. Uses prepared `SELECT 1` statement.
- `accept(code: string): void` — `INSERT OR REPLACE` with `id = 1`. Idempotent: calling again with a different code replaces the row.
- `close(): void` — releases the DB handle.

Internal:

- `db: DatabaseType` — better-sqlite3 instance with WAL pragma set.
- `stmtIsAccepted: Statement` — prepared `SELECT 1 FROM invite_acceptance WHERE id = 1`.
- `stmtAccept: Statement` — prepared `INSERT OR REPLACE INTO invite_acceptance (id, code, accepted_at) VALUES (1, ?, unixepoch())`.

### Invite codes module

```ts
// packages/server/src/invite-codes.ts

/**
 * Closed-beta invite codes. Distributed by the project owner via DM/email
 * to ~10 invitees. Rotation = new release with a different list.
 *
 * NOTE: this list is in a public repo — the codes are a velvet rope, not
 * authentication. The threat model is "casual r/homeassistant visitor",
 * not a determined attacker. A dedicated reader can self-invite.
 */
export const ACCEPTED_INVITE_CODES: readonly string[] = [
  'BETA-2026-ALPHA',
  'BETA-2026-BRAVO',
  'BETA-2026-CHARLIE',
  // ... real list curated by project owner before merge
]

const NORMALIZED_CODES = new Set(ACCEPTED_INVITE_CODES.map((c) => c.trim().toLowerCase()))

/**
 * Case-insensitive, whitespace-trimmed comparison. Friendly to invitees
 * who copy-paste with leading spaces or lowercase the code.
 */
export function isValidInviteCode(code: string): boolean {
  if (typeof code !== 'string' || code.length === 0) return false
  return NORMALIZED_CODES.has(code.trim().toLowerCase())
}
```

---

## API contract

### `GET /api/invite`

Public (not blocked by gate). Frontend calls this at startup to decide whether to render the modal.

**Response (200):** `{ accepted: boolean }`

### `POST /api/invite`

Public (not blocked by gate). Body: `{ code: string }`. Validates against `ACCEPTED_INVITE_CODES`; persists on success.

**Body validation** via zod:

```ts
const PostBodySchema = z.object({
  code: z.string().min(1).max(64),
})
```

**Responses:**

- **200 `{ accepted: true }`** — valid code; `InviteStore.accept(code)` called.
- **400 `{ error: 'invalid_code', message: 'Invite code not recognized. Double-check the code or contact the project owner.' }`** — code didn't match.
- **400 `{ error: 'invalid_body', message: '<zod path>: <message>' }`** — missing/malformed body.
- **500 `{ error: 'storage_error', message: <db error> }`** — better-sqlite3 threw.

**Why `min(1)` on code:** prevents empty-string submissions from reaching the validator (where they'd just match nothing and return 400 anyway, but with a less helpful message).
**Why `max(64)`:** prevents pathological input. Real codes are ~16 characters.

### Gate hook bypass list

The `onRequest` hook lets through:

- `/api/health` — Supervisor polls it; gating it would mark the addon unhealthy on every fresh install
- `/api/invite` (with `startsWith` so `/api/invite?cache=0` and any future `/api/invite/anything` work)

The route plugin only registers `/api/invite` exactly. Anything matching `/api/invite-bypass` or similar gets a 404 from Fastify (the plugin returns "not found" for unmatched paths under its prefix).

---

## Server gate (Fastify `onRequest` hook)

Registered in `app.ts` BEFORE any route plugins so it runs first on every request.

```ts
app.addHook('onRequest', async (req, reply) => {
  // Only gate /api/* paths. Static SPA assets must always be reachable
  // so the user can see the invite modal on first run.
  if (!req.url.startsWith('/api/')) return

  // Public API routes that bypass the gate:
  if (req.url.startsWith('/api/health') || req.url.startsWith('/api/invite')) return

  if (!opts.invite.isAccepted()) {
    return reply.code(403).send({
      error: 'invite_required',
      message: 'Invite code required to continue.',
    })
  }
})
```

`opts.invite` is the `InviteStore` instance, threaded the same way `opts.ha` and `opts.overrides` are today. `CreateAppOptions` gains `invite: InviteStore`.

**`main.ts` change:**

```ts
const invitePath = resolve(config.dataDir, 'lovelacer.sqlite')
// SAME file as the OverrideStore. Both classes call CREATE TABLE IF NOT EXISTS,
// so two parallel stores share one DB file safely.
const invite = new InviteStore(invitePath)
logger.info({ path: invitePath }, 'invite store opened')

const app = await createApp({ ha, overrides, invite, ... })

const shutdown = async (signal: string) => {
  app.log.info({ signal }, 'shutting down')
  try {
    await ha.disconnect()
    await app.close()
  } finally {
    overrides.close()
    invite.close()
  }
  process.exit(0)
}
```

**Hook performance:** every `/api/analyze` etc. triggers a `SELECT 1 FROM invite_acceptance WHERE id = 1`. With WAL + a prepared statement + a single-row table, this is ~10 µs. No caching needed at MVP scope.

**Hook ordering:** registered AFTER `@fastify/cors` and `@fastify/sensible` (so they pre-process the request) but BEFORE route handlers. Fastify executes hooks in registration order; placing it between middlewares and routes is the canonical "gate" location.

---

## Frontend modal flow

### `useInviteStore` Pinia store

Mirrors `useOverridesStore` (setup-style, phase enum, error envelope).

```ts
// packages/web/src/stores/invite.ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getInvite, postInvite } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'submitting' | 'error'

export const useInviteStore = defineStore('invite', () => {
  const accepted = ref<boolean | null>(null) // null = unknown, before first GET
  const phase = ref<Phase>('idle')
  const error = ref<ApiError | null>(null)

  async function loadStatus(): Promise<void> {
    phase.value = 'loading'
    error.value = null
    try {
      const result = await getInvite()
      accepted.value = result.accepted
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  async function submit(code: string): Promise<void> {
    phase.value = 'submitting'
    error.value = null
    try {
      const result = await postInvite({ code })
      accepted.value = result.accepted
      phase.value = 'idle'
    } catch (err) {
      error.value = err as ApiError
      phase.value = 'error'
    }
  }

  return { accepted, phase, error, loadStatus, submit }
})
```

`accepted: boolean | null` distinguishes "haven't checked yet" (null) from "checked, false" (modal renders) and "checked, true" (modal hidden).

### `InviteGate.vue` component

Full-page overlay (`fixed inset-0 z-50`), centered card. Dimmed background. Single text input, submit button, error display.

Test selectors: `data-testid="invite-gate"`, `data-testid="invite-input"`, `data-testid="invite-submit"`, `data-testid="invite-error"`.

Behavior:

- Submit button disabled when input is empty OR while `phase === 'submitting'`
- On submit: `e.preventDefault()`, then `invite.submit(code.value)`
- Wrong code → `phase === 'error'`, error message shown under input, code preserved (user can retype)
- Correct code → `accepted.value = true`, modal disappears (controlled by `<InviteGate v-if="invite.accepted === false">` in App.vue)

### Error message copy

```ts
const errorMessage = computed(() => {
  if (invite.phase !== 'error' || invite.error === null) return ''
  if (invite.error.error === 'invalid_code') {
    return "That invite code wasn't recognized. Double-check the code or contact the project owner."
  }
  if (invite.error.error === 'invalid_body') return 'Please enter your invite code.'
  if (invite.error.error === 'network') return 'Could not reach the server. Try again in a moment.'
  return invite.error.message
})
```

### `App.vue` wiring

```vue
<script setup lang="ts">
import { onMounted } from 'vue'
import { useInviteStore } from './stores/invite.js'
import InviteGate from './components/InviteGate.vue'
// ... existing imports ...

const invite = useInviteStore()

onMounted(() => {
  void invite.loadStatus()
})
</script>

<template>
  <main class="mx-auto max-w-3xl space-y-6 p-8">
    <!-- ... existing layout (HealthBar, AnalyzeButton, RoomList, etc.) ... -->
  </main>

  <InviteGate v-if="invite.accepted === false" />
</template>
```

`v-if="invite.accepted === false"` — modal renders ONLY after `loadStatus` resolves with a definitive `false`. While `accepted === null` (initial state, before first GET resolves), the modal is hidden — user briefly sees the App skeleton, then the modal appears (~50ms typical) or never (if accepted).

### Successful submit flow

1. User types `BETA-2026-ALPHA`, clicks Continue
2. `invite.submit('BETA-2026-ALPHA')` → `POST /api/invite`
3. Server: `isValidInviteCode` returns true → `inviteStore.accept(code)` → 200 `{ accepted: true }`
4. Store: `accepted.value = true`, `phase.value = 'idle'`
5. Vue re-renders: `<InviteGate v-if="invite.accepted === false">` evaluates false, modal disappears
6. User sees the existing App layout, can click Analyze

No automatic re-analyze trigger — the user clicks Analyze themselves. The acceptance is a one-time event.

### `ApiError` extension

In `packages/web/src/api/types.ts`, extend the union:

```ts
export interface ApiError {
  error:
    | 'ha_unavailable'
    | 'analyze_failed'
    | 'preview_failed'
    | 'invalid_config'
    | 'ha_apply_failed'
    | 'apply_failed'
    | 'invalid_body'
    | 'storage_error'
    | 'invite_required'
    | 'invalid_code'
    | 'network'
  step?: 'list' | 'create' | 'save'
  message: string
}
```

`'invite_required'` is the gate's 403 error; `'invalid_code'` is the validation 400.

---

## Testing strategy

### `InviteStore` unit tests — `packages/server/src/storage/__tests__/invite-store.test.ts`

`:memory:` per test, mirrors `OverrideStore` test patterns:

- `isAccepted()` on empty DB returns false
- `accept(code)` then `isAccepted()` returns true
- `accept` is idempotent — calling twice with different codes leaves a single row, latest code stored (verify via raw SELECT)
- Schema CHECK rejects insert with id != 1 (verified via raw SQL bypass — defense-in-depth)
- `accept('')` is fine at the storage layer — empty-string validation is the route's job
- `creates parent directory recursively for file-based DBs` (mirrors the OverrideStore test)

### `invite-codes` module tests — `packages/server/src/__tests__/invite-codes.test.ts`

- `isValidInviteCode('BETA-2026-ALPHA')` returns true (exact match)
- `isValidInviteCode('beta-2026-alpha')` returns true (case-insensitive)
- `isValidInviteCode('  BETA-2026-ALPHA  ')` returns true (whitespace trim)
- `isValidInviteCode('BETA-2026-WRONG')` returns false
- `isValidInviteCode('')` returns false
- `isValidInviteCode(null as unknown as string)` returns false (type guard)
- `ACCEPTED_INVITE_CODES` is non-empty (sanity)

### Route tests — `packages/server/src/__tests__/routes/invite.test.ts`

`createApp` + `inject` pattern. Real `:memory:` `InviteStore` per test:

- `GET /api/invite` returns `{ accepted: false }` on fresh store
- `GET /api/invite` returns `{ accepted: true }` after a valid POST
- `POST /api/invite` with valid code returns 200 + persists; subsequent GET reflects acceptance
- `POST /api/invite` with invalid code returns 400 `invalid_code` + does NOT persist
- `POST /api/invite` with empty body returns 400 `invalid_body`
- `POST /api/invite` with case-insensitive code → 200
- `POST /api/invite` with leading/trailing whitespace code → 200

### Gate hook tests — `packages/server/src/__tests__/routes/invite-gate.test.ts`

Verify the onRequest hook gates correctly. Real `InviteStore` (`:memory:`), full `createApp`:

- Fresh store (not accepted): `POST /api/analyze` returns 403 `invite_required`
- Fresh store: `POST /api/preview` returns 403
- Fresh store: `POST /api/apply` returns 403
- Fresh store: `GET /api/overrides` returns 403
- Fresh store: `GET /api/health` returns 200 (always public)
- Fresh store: `GET /api/invite` returns 200 (always public)
- Fresh store: `POST /api/invite` with valid code returns 200 (always public)
- After accepting: `POST /api/analyze` is no longer gated (returns whatever its handler returns — not 403)

### `useInviteStore` Pinia tests — `packages/web/src/__tests__/stores/invite.test.ts`

`createPinia` + mocked API client (same pattern as `overrides.test.ts`):

- Initial state: `accepted: null`, `phase: 'idle'`, `error: null`
- `loadStatus` sets `accepted` from server response
- `loadStatus` on 500 sets `phase: 'error'` + preserves `accepted` (whatever it was)
- `submit(validCode)` sets `accepted: true`, `phase: 'idle'`
- `submit(wrongCode)` sets `phase: 'error'`, `error.error === 'invalid_code'`, `accepted` stays as previous value
- `submit(emptyCode)` — actually shouldn't happen because the button is disabled on empty input, but for defense the test asserts the API client throws and the store handles it gracefully

### `InviteGate` component tests — `packages/web/src/__tests__/components/InviteGate.test.ts`

`@vue/test-utils` + `createTestingPinia({ stubActions: false, createSpy: vi.fn })`:

- Renders the form with input + submit button + correct heading text
- Submit button disabled when input is empty
- Submit button disabled while `phase: 'submitting'`
- Submitting calls `invite.submit` with the typed code
- On `phase: 'error'` with `error.error === 'invalid_code'`, error message shown under input
- Error message copy correct for each error type (invalid_code, invalid_body, network)
- Code preserved after a wrong-code submission (user can retype)

### `App.test.ts` integration update

Extend the existing App integration tests:

- New: `loadStatus is called on App mount` (verify mocked `getInvite` was called once)
- New: while `accepted === false`, `[data-testid="invite-gate"]` is rendered AND main `<main>` is also rendered (overlay pattern, both visible)
- New: while `accepted === true`, `[data-testid="invite-gate"]` is NOT rendered
- New: while `accepted === null` (loading state), `[data-testid="invite-gate"]` is NOT rendered

### What's NOT tested

- The actual values in `ACCEPTED_INVITE_CODES` — testing those would lock down the rotation list. The codes module is tested via `isValidInviteCode` behavior.
- HA Supervisor's health-check polling — out of scope; the hook bypass for `/api/health` is unit-tested.
- Clock manipulation across timezones for `accepted_at` — the timestamp is informational, not load-bearing.
- Cross-instance behavior (multiple addon installs sharing the same code list) — not applicable; each addon has its own `/data/lovelacer.sqlite`.

---

## Acceptance

- [ ] `ACCEPTED_INVITE_CODES` and `isValidInviteCode()` in `packages/server/src/invite-codes.ts`.
- [ ] `InviteStore` class with `isAccepted`, `accept`, `close` methods. Single-row schema with CHECK constraint. WAL mode. Hoisted prepared statements.
- [ ] `:memory:` for tests; mkdirSync for file paths (mirrors OverrideStore).
- [ ] `GET /api/invite` returns `{ accepted: boolean }`.
- [ ] `POST /api/invite` validates body via zod, calls `isValidInviteCode`, persists via `InviteStore.accept` on success.
- [ ] 400 `invalid_code` on wrong code; 400 `invalid_body` on bad body; 500 `storage_error` on DB exceptions.
- [ ] Fastify `onRequest` hook gates `/api/*` (except `/api/health` and `/api/invite`) with 403 `invite_required` until accepted.
- [ ] `createApp` accepts `invite: InviteStore` in options and registers the new route plugin + hook.
- [ ] `main.ts` instantiates `InviteStore` from `${config.dataDir}/lovelacer.sqlite`, closes in shutdown alongside `OverrideStore.close`.
- [ ] Frontend: `getInvite` and `postInvite` API client functions; `ApiError` union extended with `'invite_required'` and `'invalid_code'`.
- [ ] `useInviteStore` Pinia store with `accepted` (boolean | null) tri-state, `phase`, `error`, `loadStatus`, `submit`.
- [ ] `InviteGate.vue` modal — full-page overlay, code input, submit button, error display, friendly copy.
- [ ] `App.vue` calls `invite.loadStatus()` on mount; renders `<InviteGate>` when `accepted === false`.
- [ ] Tests: 6 InviteStore + 7 invite-codes + 7 route + 8 gate + 5 store + 7 component + 4 App integration = ~44 new tests.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean.
