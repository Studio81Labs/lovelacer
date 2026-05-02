# P1b-6 Friendly Invite Flow Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Closed-beta gating: the Add-on prompts for an invite code on first run; right code unlocks, wrong code shows a polite error. Acceptance persists in SQLite across restarts.

**Architecture:** A server-side `InviteStore` (single-row SQLite table) parallel to `OverrideStore`, plus a Fastify `onRequest` hook that returns 403 on every `/api/*` request (except `/api/health` and `/api/invite`) until acceptance. New route plugin handles `GET /api/invite` (status) and `POST /api/invite` (validate + persist). Frontend has a `useInviteStore` Pinia store that gates the App with a full-page `InviteGate.vue` modal until the user submits a valid code.

**Tech Stack:** TypeScript (strict, `verbatimModuleSyntax`, `exactOptionalPropertyTypes`), better-sqlite3, zod, Fastify hooks/plugins, Vitest (`globals: false`), Vue 3 + `<script setup>`, Pinia, Tailwind 4.

**Spec reference:** [`docs/superpowers/specs/2026-05-02-p1b-6-friendly-invite-flow-design.md`](../specs/2026-05-02-p1b-6-friendly-invite-flow-design.md)

---

## Conventions used in this plan

- ESM with explicit `.js` import extensions even when importing TS source.
- Type-only imports use `import type { … } from '…'`.
- Tests use `import { describe, it, expect, vi, beforeEach } from 'vitest'`.
- All commands run from worktree: `pnpm --dir <worktree>` and `git -C <worktree>`.
- Each task ends with one commit + the `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>` trailer.
- After each task, run `pnpm typecheck && pnpm -r test`.

---

## File structure

**New files:**

- `packages/server/src/invite-codes.ts` — `ACCEPTED_INVITE_CODES` const + `isValidInviteCode()` helper
- `packages/server/src/storage/invite-store.ts` — `InviteStore` class
- `packages/server/src/storage/__tests__/invite-store.test.ts`
- `packages/server/src/__tests__/invite-codes.test.ts`
- `packages/server/src/routes/invite.ts` — Fastify route plugin (GET + POST)
- `packages/server/src/__tests__/routes/invite.test.ts`
- `packages/server/src/__tests__/routes/invite-gate.test.ts`
- `packages/web/src/stores/invite.ts` — `useInviteStore` Pinia store
- `packages/web/src/__tests__/stores/invite.test.ts`
- `packages/web/src/components/InviteGate.vue` — modal component
- `packages/web/src/__tests__/components/InviteGate.test.ts`

**Modified files:**

- `packages/server/src/app.ts` — accept `invite: InviteStore` in options, register gate hook + route plugin
- `packages/server/src/main.ts` — instantiate `InviteStore`, close in shutdown
- `packages/server/src/__tests__/routes/analyze.test.ts` — pass `invite` option, accept gate before through-traffic tests
- `packages/server/src/__tests__/routes/preview.test.ts` — same
- `packages/server/src/__tests__/routes/apply.test.ts` — same
- `packages/web/src/api/types.ts` — extend `ApiError.error` union
- `packages/web/src/api/client.ts` — add `getInvite()` and `postInvite(body)`
- `packages/web/src/__tests__/api/client.test.ts` — extend with new function tests
- `packages/web/src/App.vue` — call `loadStatus()` on mount, render `<InviteGate>` overlay
- `packages/web/src/__tests__/App.test.ts` — integration tests for the gate

---

## Task 1: Server foundation — invite-codes module + InviteStore

**Files:**

- Create: `packages/server/src/invite-codes.ts`
- Create: `packages/server/src/__tests__/invite-codes.test.ts`
- Create: `packages/server/src/storage/invite-store.ts`
- Create: `packages/server/src/storage/__tests__/invite-store.test.ts`

Pure foundation — no wiring yet. Both modules are exported but not yet used.

- [ ] **Step 1: Write the invite-codes test file**

Create `packages/server/src/__tests__/invite-codes.test.ts`:

```ts
import { describe, it, expect } from 'vitest'
import { ACCEPTED_INVITE_CODES, isValidInviteCode } from '../invite-codes.js'

describe('isValidInviteCode', () => {
  it('returns true for an exact match', () => {
    expect(isValidInviteCode('BETA-2026-ALPHA')).toBe(true)
  })

  it('returns true for case-insensitive match', () => {
    expect(isValidInviteCode('beta-2026-alpha')).toBe(true)
    expect(isValidInviteCode('Beta-2026-Alpha')).toBe(true)
  })

  it('returns true for whitespace-trimmed match', () => {
    expect(isValidInviteCode('  BETA-2026-ALPHA  ')).toBe(true)
    expect(isValidInviteCode('\tBETA-2026-ALPHA\n')).toBe(true)
  })

  it('returns false for unknown code', () => {
    expect(isValidInviteCode('BETA-2026-WRONG')).toBe(false)
  })

  it('returns false for empty string', () => {
    expect(isValidInviteCode('')).toBe(false)
  })

  it('returns false for non-string input', () => {
    expect(isValidInviteCode(null as unknown as string)).toBe(false)
    expect(isValidInviteCode(undefined as unknown as string)).toBe(false)
  })
})

describe('ACCEPTED_INVITE_CODES', () => {
  it('is non-empty', () => {
    expect(ACCEPTED_INVITE_CODES.length).toBeGreaterThan(0)
  })

  it('contains the BETA-2026-ALPHA test code', () => {
    expect(ACCEPTED_INVITE_CODES).toContain('BETA-2026-ALPHA')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/__tests__/invite-codes.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the invite-codes module**

Create `packages/server/src/invite-codes.ts`:

```ts
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
  'BETA-2026-DELTA',
  'BETA-2026-ECHO',
  'BETA-2026-FOXTROT',
  'BETA-2026-GOLF',
  'BETA-2026-HOTEL',
  'BETA-2026-INDIA',
  'BETA-2026-JULIET',
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

- [ ] **Step 4: Verify invite-codes tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/__tests__/invite-codes.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Write the InviteStore test file**

Create `packages/server/src/storage/__tests__/invite-store.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { InviteStore } from '../invite-store.js'

let store: InviteStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

function makeStore(): InviteStore {
  store = new InviteStore(':memory:')
  return store
}

describe('InviteStore', () => {
  it('isAccepted() on empty DB returns false', () => {
    const s = makeStore()
    expect(s.isAccepted()).toBe(false)
  })

  it('accept() then isAccepted() returns true', () => {
    const s = makeStore()
    s.accept('BETA-2026-ALPHA')
    expect(s.isAccepted()).toBe(true)
  })

  it('accept() is idempotent — re-accept replaces the row', () => {
    const filename = join(tmpdir(), `invite-store-test-${Date.now()}.sqlite`)
    const s = new InviteStore(filename)
    try {
      s.accept('BETA-2026-ALPHA')
      s.accept('BETA-2026-BRAVO')
      const raw = new Database(filename, { readonly: true })
      const rows = raw.prepare('SELECT id, code FROM invite_acceptance').all() as {
        id: number
        code: string
      }[]
      raw.close()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({ id: 1, code: 'BETA-2026-BRAVO' })
    } finally {
      s.close()
      rmSync(filename, { force: true })
    }
  })

  it('schema CHECK rejects insert with id != 1', () => {
    const s = makeStore()
    const db = (s as unknown as { db: Database.Database }).db
    expect(() => {
      db.prepare('INSERT INTO invite_acceptance (id, code) VALUES (2, ?)').run('foo')
    }).toThrow()
  })

  it('accept() with empty string is allowed at the storage layer', () => {
    const s = makeStore()
    s.accept('')
    expect(s.isAccepted()).toBe(true)
  })

  it('creates parent directory recursively for file-based DBs', () => {
    const baseDir = join(tmpdir(), `invite-store-test-${Date.now()}`)
    const filePath = join(baseDir, 'sub', 'lovelacer.sqlite')
    expect(existsSync(baseDir)).toBe(false)
    const s = new InviteStore(filePath)
    try {
      expect(existsSync(join(baseDir, 'sub'))).toBe(true)
      expect(s.isAccepted()).toBe(false)
    } finally {
      s.close()
      rmSync(baseDir, { recursive: true, force: true })
    }
  })
})
```

- [ ] **Step 6: Run the InviteStore test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/storage/__tests__/invite-store.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create the InviteStore class**

Create `packages/server/src/storage/invite-store.ts`:

```ts
import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS invite_acceptance (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    code        TEXT NOT NULL,
    accepted_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

/**
 * SQLite-backed persistence for the closed-beta invite acceptance flag.
 *
 * Single-row table: id = 1 always (CHECK constraint enforces). Calling
 * accept() with id = 1 INSERT OR REPLACE pattern means re-accept (which
 * shouldn't happen in normal flow) replaces rather than duplicates.
 *
 * Constructor accepts ':memory:' for tests; for file paths the parent
 * dir is created if missing (mirrors OverrideStore).
 */
export class InviteStore {
  private readonly db: DatabaseType
  private readonly stmtIsAccepted: Statement
  private readonly stmtAccept: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)
    this.stmtIsAccepted = this.db.prepare('SELECT 1 FROM invite_acceptance WHERE id = 1')
    this.stmtAccept = this.db.prepare(
      'INSERT OR REPLACE INTO invite_acceptance (id, code, accepted_at) VALUES (1, ?, unixepoch())',
    )
  }

  isAccepted(): boolean {
    return this.stmtIsAccepted.get() !== undefined
  }

  accept(code: string): void {
    this.stmtAccept.run(code)
  }

  close(): void {
    this.db.close()
  }
}
```

- [ ] **Step 8: Verify InviteStore tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/storage/__tests__/invite-store.test.ts
```

Expected: PASS — 6 tests.

- [ ] **Step 9: Run full workspace verification**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
```

Both green.

- [ ] **Step 10: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/server/src/invite-codes.ts packages/server/src/storage/invite-store.ts packages/server/src/__tests__/invite-codes.test.ts packages/server/src/storage/__tests__/invite-store.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(server): InviteStore + invite-codes module for closed-beta gating

Two pure foundation modules for P1b-6's friendly invite flow:

- invite-codes.ts: ACCEPTED_INVITE_CODES const (10 codes, alpha-juliet
  NATO phonetic) plus isValidInviteCode() helper. Case-insensitive
  whitespace-trim. The list is in a public repo by design — the codes
  are a velvet rope, not authentication.

- storage/invite-store.ts: InviteStore class wrapping better-sqlite3
  for the single-row invite_acceptance table (CHECK id=1 enforces
  single-row at SQL level). accept() is INSERT OR REPLACE so re-accept
  silently replaces. Mirrors OverrideStore conventions: prepared
  statements hoisted to constructor, ':memory:' short-circuits
  mkdirSync, WAL mode.

Tests: 8 invite-codes (case/whitespace/empty/null) plus 6 InviteStore
(empty/accept/idempotent/CHECK/empty-code-allowed/mkdir).

Not yet wired — Tasks 2-3 add the route plugin + gate hook.

P1b-6 layer 1 of 6 (foundation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 2: Server route plugin — `GET /api/invite` + `POST /api/invite`

**Files:**

- Create: `packages/server/src/routes/invite.ts`
- Create: `packages/server/src/__tests__/routes/invite.test.ts`

The route plugin accepts `invite: InviteStore` in opts. Tests use a real `:memory:` store. The plugin is not yet registered in `app.ts` — Task 3 adds that.

- [ ] **Step 1: Write the failing test file**

Create `packages/server/src/__tests__/routes/invite.test.ts`:

```ts
import { describe, it, expect, afterEach } from 'vitest'
import Fastify from 'fastify'
import sensible from '@fastify/sensible'
import { InviteStore } from '../../storage/invite-store.js'
import { inviteRoute } from '../../routes/invite.js'

let store: InviteStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

async function makeApp() {
  store = new InviteStore(':memory:')
  const app = Fastify({ logger: false })
  await app.register(sensible)
  await app.register(inviteRoute, { invite: store })
  return app
}

describe('GET /api/invite', () => {
  it('returns 200 { accepted: false } on a fresh store', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: false })
    } finally {
      await app.close()
    }
  })

  it('returns 200 { accepted: true } after a valid POST', async () => {
    const app = await makeApp()
    try {
      await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
    } finally {
      await app.close()
    }
  })
})

describe('POST /api/invite', () => {
  it('returns 200 with valid code, persists', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_code with wrong code, does NOT persist', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'WRONG-CODE' },
      })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_code' })
      expect(store!.isAccepted()).toBe(false)
    } finally {
      await app.close()
    }
  })

  it('returns 400 invalid_body with empty body', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({ method: 'POST', url: '/api/invite' })
      expect(res.statusCode).toBe(400)
      expect(res.json()).toMatchObject({ error: 'invalid_body' })
    } finally {
      await app.close()
    }
  })

  it('accepts case-insensitive code', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'beta-2026-alpha' },
      })
      expect(res.statusCode).toBe(200)
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })

  it('accepts code with leading/trailing whitespace', async () => {
    const app = await makeApp()
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: '  BETA-2026-ALPHA  ' },
      })
      expect(res.statusCode).toBe(200)
      expect(store!.isAccepted()).toBe(true)
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/__tests__/routes/invite.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the route plugin**

Create `packages/server/src/routes/invite.ts`:

```ts
import type { FastifyInstance, FastifyPluginAsync } from 'fastify'
import { z } from 'zod'
import { isValidInviteCode } from '../invite-codes.js'
import type { InviteStore } from '../storage/invite-store.js'

export interface InviteRouteOptions {
  invite: InviteStore
}

const PostBodySchema = z.object({
  code: z.string().min(1).max(64),
})

/**
 * GET  /api/invite — returns { accepted: boolean }.
 * POST /api/invite — body: { code }. Validates against
 *                    ACCEPTED_INVITE_CODES; persists on success.
 *
 * Both endpoints are public (bypass the gate hook). The hook in app.ts
 * lets through any request with path matching /api/invite (startsWith),
 * so this plugin is reachable on first run before acceptance.
 *
 * Errors:
 * - 400 invalid_body — body fails zod schema (missing/empty code).
 * - 400 invalid_code — code didn't match.
 * - 500 storage_error — better-sqlite3 threw.
 */
export const inviteRoute: FastifyPluginAsync<InviteRouteOptions> = async (
  app: FastifyInstance,
  opts,
) => {
  app.get('/api/invite', async () => {
    return { accepted: opts.invite.isAccepted() }
  })

  app.post('/api/invite', async (req, reply) => {
    const parsed = PostBodySchema.safeParse(req.body)
    if (!parsed.success) {
      return reply.code(400).send({
        error: 'invalid_body',
        message: parsed.error.issues
          .map((i) => `${i.path.join('.')}: ${i.message}`)
          .join('; '),
      })
    }

    const { code } = parsed.data
    if (!isValidInviteCode(code)) {
      return reply.code(400).send({
        error: 'invalid_code',
        message:
          'Invite code not recognized. Double-check the code or contact the project owner.',
      })
    }

    try {
      opts.invite.accept(code)
      return reply.code(200).send({ accepted: true })
    } catch (err) {
      req.log.error({ err }, 'invite acceptance failed')
      return reply.code(500).send({ error: 'storage_error', message: String(err) })
    }
  })
}
```

- [ ] **Step 4: Verify the route tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/__tests__/routes/invite.test.ts
```

Expected: PASS — 7 tests.

- [ ] **Step 5: Run full workspace verification**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/server/src/routes/invite.ts packages/server/src/__tests__/routes/invite.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(server): /api/invite GET + POST route plugin

Fastify plugin with two endpoints. GET /api/invite returns
{ accepted: boolean } based on InviteStore.isAccepted(). POST
/api/invite validates body via zod (code: string, min 1, max 64),
checks isValidInviteCode, and persists via InviteStore.accept on
success.

Errors:
- 400 invalid_body on missing/malformed body
- 400 invalid_code on unrecognized code (with friendly message)
- 500 storage_error on DB exceptions

Plugin opts: { invite: InviteStore } — same DI pattern as the
existing analyze/preview/apply/overrides routes.

Seven route tests cover the empty GET, post-acceptance GET, valid
POST, wrong-code POST, missing-body POST, case-insensitive POST,
and whitespace-trim POST. Tests instantiate a real InviteStore with
':memory:' so they exercise the storage layer end-to-end.

Plugin not yet registered in app.ts — Task 3 adds the registration
and the gate hook.

P1b-6 layer 2 of 6 (route plugin).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 3: Server gate hook + wiring

**Files:**

- Modify: `packages/server/src/app.ts`
- Modify: `packages/server/src/main.ts`
- Modify: `packages/server/src/__tests__/routes/analyze.test.ts`
- Modify: `packages/server/src/__tests__/routes/preview.test.ts`
- Modify: `packages/server/src/__tests__/routes/apply.test.ts`
- Create: `packages/server/src/__tests__/routes/invite-gate.test.ts`

This is the wiring task — touches many files. The gate hook is registered before any route handler. `CreateAppOptions` gains `invite: InviteStore`. Each existing route test that hits a gated route must pre-accept by calling `store.accept('BETA-2026-ALPHA')` before the test request. Atomic commit because everything has to land together for the project to compile.

- [ ] **Step 1: Update `CreateAppOptions` and `createApp` body**

Read `packages/server/src/app.ts`. Find the `CreateAppOptions` interface. Add the new field:

```ts
export interface CreateAppOptions {
  ha: HaClient
  overrides: OverrideStore
  invite: InviteStore  // NEW
  isDev?: boolean
  // ... rest unchanged
}
```

Add the import at the top:

```ts
import { inviteRoute } from './routes/invite.js'
import type { InviteStore } from './storage/invite-store.js'
```

Find where the existing routes are registered. BEFORE the route registrations, add the gate hook:

```ts
  // Gate hook: returns 403 invite_required for any /api/* request unless
  // the invite has been accepted. /api/health and /api/invite are always
  // public (Supervisor health-checks the former; the user submits the
  // code to the latter on first run).
  app.addHook('onRequest', async (req, reply) => {
    if (!req.url.startsWith('/api/')) return
    if (req.url.startsWith('/api/health') || req.url.startsWith('/api/invite')) return
    if (!opts.invite.isAccepted()) {
      return reply.code(403).send({
        error: 'invite_required',
        message: 'Invite code required to continue.',
      })
    }
  })
```

Add the invite route registration alongside the existing route registrations:

```ts
  await app.register(inviteRoute, { invite: opts.invite })
  await app.register(analyzeRoute, { ha: opts.ha, overrides: opts.overrides })
  await app.register(previewRoute, { ha: opts.ha, overrides: opts.overrides })
  await app.register(applyRoute, {
    ha: opts.ha,
    overrides: opts.overrides,
    dashboardUrlPath: opts.dashboardUrlPath,
  })
  await app.register(overridesRoute, { overrides: opts.overrides })
```

(Order matters for plugin precedence; invite first so it's available even if subsequent routes throw on registration.)

- [ ] **Step 2: Update `main.ts` to instantiate `InviteStore`**

Read `packages/server/src/main.ts`. Add the import:

```ts
import { InviteStore } from './storage/invite-store.js'
```

After the `OverrideStore` instantiation, add:

```ts
  const invitePath = resolve(config.dataDir, 'lovelacer.sqlite')
  const invite = new InviteStore(invitePath)
  logger.info({ path: invitePath }, 'invite store opened')
```

(Same path as the override store's. Both `CREATE TABLE IF NOT EXISTS` so they share the file safely.)

Update the `createApp` call to pass `invite`:

```ts
  const app = await createApp({
    ha,
    overrides,
    invite,  // NEW
    isDev,
    // ... rest unchanged
  })
```

Update the shutdown handler to close `invite` alongside `overrides`:

```ts
  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'shutting down')
    try {
      await ha.disconnect()
      await app.close()
    } finally {
      overrides.close()
      invite.close()  // NEW
    }
    process.exit(0)
  }
```

- [ ] **Step 3: Update `analyze.test.ts` to pass `invite` and accept the gate**

Read `packages/server/src/__tests__/routes/analyze.test.ts`. Add the import at the top:

```ts
import { InviteStore } from '../../storage/invite-store.js'
```

Add a small helper near the top of the file (after the existing helpers):

```ts
function makeAcceptedInvite(): InviteStore {
  const s = new InviteStore(':memory:')
  s.accept('BETA-2026-ALPHA')
  return s
}
```

For every existing `createApp({ ... })` call in the file, add `invite: makeAcceptedInvite()` to the options object. Example:

```ts
// Before:
const app = await createApp({
  ha,
  overrides: makeStore(),
  logLevel: 'silent',
  dashboardUrlPath: 'lovelacer-home',
})

// After:
const app = await createApp({
  ha,
  overrides: makeStore(),
  invite: makeAcceptedInvite(),
  logLevel: 'silent',
  dashboardUrlPath: 'lovelacer-home',
})
```

Find every `createApp` call (typically 3 in `analyze.test.ts`) and apply the same change.

- [ ] **Step 4: Apply the same pattern to `preview.test.ts` and `apply.test.ts`**

Read each of:
- `packages/server/src/__tests__/routes/preview.test.ts`
- `packages/server/src/__tests__/routes/apply.test.ts`

Add the same `import { InviteStore } from '../../storage/invite-store.js'` at the top of each.
Add the same `makeAcceptedInvite()` helper near the top of each file.
Update every `createApp({ ... })` call to include `invite: makeAcceptedInvite()` in the options. There are ~3 calls in `preview.test.ts` and ~7 in `apply.test.ts`.

- [ ] **Step 5: Verify pre-existing route tests still pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server/src/__tests__/routes/analyze.test.ts packages/server/src/__tests__/routes/preview.test.ts packages/server/src/__tests__/routes/apply.test.ts
```

Expected: PASS — every test should still pass because the invite is pre-accepted in `makeAcceptedInvite()`. If a test fails with 403 invite_required, it means `invite: makeAcceptedInvite()` was missed in that test's `createApp` call.

- [ ] **Step 6: Write the gate hook test file**

Create `packages/server/src/__tests__/routes/invite-gate.test.ts`:

```ts
import { describe, it, expect, vi, afterEach } from 'vitest'
import type { HaClient } from '@lovelacer/ha-client'
import { englishCluttered } from '../../../../../tests/fixtures/english-cluttered.js'
import { fixtureToHaRegistries } from '../../../../../tests/fixtures/_builder/index.js'
import { createApp } from '../../app.js'
import { InviteStore } from '../../storage/invite-store.js'
import { OverrideStore } from '../../storage/override-store.js'

let invite: InviteStore | null = null

afterEach(() => {
  invite?.close()
  invite = null
})

function makeHa(): HaClient {
  const ha = fixtureToHaRegistries(englishCluttered)
  return {
    isConnected: () => true,
    getEntityRegistry: vi.fn(async () => ha.entities),
    getDeviceRegistry: vi.fn(async () => ha.devices),
    getAreaRegistry: vi.fn(async () => ha.areas),
    getFloorRegistry: vi.fn(async () => []),
  } as unknown as HaClient
}

async function makeApp(opts: { accepted: boolean }) {
  invite = new InviteStore(':memory:')
  if (opts.accepted) invite.accept('BETA-2026-ALPHA')
  return createApp({
    ha: makeHa(),
    overrides: new OverrideStore(':memory:'),
    invite,
    logLevel: 'silent',
    dashboardUrlPath: 'lovelacer-home',
  })
}

describe('invite gate hook', () => {
  it('blocks POST /api/analyze with 403 invite_required when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks POST /api/preview with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/preview' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks POST /api/apply with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/apply',
        payload: { config: { title: 'x', views: [] } },
      })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('blocks GET /api/overrides with 403 when not accepted', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/overrides' })
      expect(res.statusCode).toBe(403)
      expect(res.json()).toMatchObject({ error: 'invite_required' })
    } finally {
      await app.close()
    }
  })

  it('allows GET /api/health regardless of acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/health' })
      expect(res.statusCode).toBe(200)
    } finally {
      await app.close()
    }
  })

  it('allows GET /api/invite regardless of acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({ method: 'GET', url: '/api/invite' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: false })
    } finally {
      await app.close()
    }
  })

  it('allows POST /api/invite with valid code regardless of prior acceptance', async () => {
    const app = await makeApp({ accepted: false })
    try {
      const res = await app.inject({
        method: 'POST',
        url: '/api/invite',
        payload: { code: 'BETA-2026-ALPHA' },
      })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ accepted: true })
    } finally {
      await app.close()
    }
  })

  it('after acceptance, POST /api/analyze is no longer 403', async () => {
    const app = await makeApp({ accepted: true })
    try {
      const res = await app.inject({ method: 'POST', url: '/api/analyze' })
      // The handler runs (returns 200 with analyze result, or 503 if HA
      // is fake-disconnected). The POINT is the gate didn't intercept.
      expect(res.statusCode).not.toBe(403)
    } finally {
      await app.close()
    }
  })
})
```

- [ ] **Step 7: Verify all server tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/server
```

Expected: PASS — existing route tests + 8 new gate tests + 7 invite route tests + 6 InviteStore tests + 8 invite-codes tests.

- [ ] **Step 8: Run full workspace verification**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
```

Both green.

- [ ] **Step 9: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/server/src/app.ts packages/server/src/main.ts packages/server/src/__tests__/routes/analyze.test.ts packages/server/src/__tests__/routes/preview.test.ts packages/server/src/__tests__/routes/apply.test.ts packages/server/src/__tests__/routes/invite-gate.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(server): wire InviteStore + register gate hook + invite route

Threads InviteStore through the call chain so the gate is enforced
end-to-end:

- CreateAppOptions gains invite: InviteStore. The new onRequest hook
  returns 403 invite_required for any /api/* request unless
  isAccepted(). /api/health and /api/invite (startsWith) bypass the
  gate so Supervisor health-checks and the first-run code submission
  always work.
- inviteRoute is registered before the other API routes so it's
  available even if subsequent registrations throw.
- main.ts instantiates InviteStore from
  config.dataDir/lovelacer.sqlite (same file as OverrideStore;
  CREATE TABLE IF NOT EXISTS makes them share safely). Closes in the
  shutdown handler alongside overrides.

Existing analyze/preview/apply route tests update to pre-accept the
invite via a small makeAcceptedInvite() helper so they continue to
exercise their happy paths without 403 noise.

Eight new gate hook tests pin the contract: gated routes return 403
when not accepted, /api/health + /api/invite always pass, and after
acceptance the gate no longer intercepts.

P1b-6 layer 3 of 6 (gate + wiring).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 4: Web foundation — types + API client + Pinia store

**Files:**

- Modify: `packages/web/src/api/types.ts`
- Modify: `packages/web/src/api/client.ts`
- Modify: `packages/web/src/__tests__/api/client.test.ts`
- Create: `packages/web/src/stores/invite.ts`
- Create: `packages/web/src/__tests__/stores/invite.test.ts`

Foundation for the frontend modal. Pure additions — no UI changes yet.

- [ ] **Step 1: Extend `ApiError.error` union**

In `packages/web/src/api/types.ts`, find the `ApiError` interface. Replace the union to add `'invite_required'` and `'invalid_code'`:

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

(Keep the existing JSDoc on `ApiError`. Only the union list changes.)

- [ ] **Step 2: Add `getInvite` and `postInvite` to client.ts**

Read `packages/web/src/api/client.ts`. Find the existing `getOverrides`/`putOverrides` functions. Append the new helpers at the bottom:

```ts
export function getInvite(): Promise<{ accepted: boolean }> {
  return fetchJson('api/invite')
}

export function postInvite(body: { code: string }): Promise<{ accepted: boolean }> {
  return fetchJson('api/invite', {
    method: 'POST',
    headers: JSON_HEADERS,
    body: JSON.stringify(body),
  })
}
```

- [ ] **Step 3: Extend `client.test.ts` with the new function tests**

Read `packages/web/src/__tests__/api/client.test.ts`. Update the import to include `getInvite` and `postInvite` (combine with the existing imports — do NOT duplicate).

Append at the end of the file:

```ts
describe('getInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('returns parsed body on 200', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accepted: true }),
    } as unknown as Response)

    const result = await getInvite()
    expect(result).toEqual({ accepted: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/invite', {})
  })
})

describe('postInvite', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('sends POST with body and returns parsed result', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: () => Promise.resolve({ accepted: true }),
    } as unknown as Response)

    const result = await postInvite({ code: 'BETA-2026-ALPHA' })
    expect(result).toEqual({ accepted: true })
    expect(globalThis.fetch).toHaveBeenCalledWith('api/invite', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code: 'BETA-2026-ALPHA' }),
    })
  })

  it('throws ApiError on invalid_code 400', async () => {
    globalThis.fetch = vi.fn().mockResolvedValueOnce({
      ok: false,
      status: 400,
      json: () =>
        Promise.resolve({
          error: 'invalid_code',
          message: 'Invite code not recognized.',
        }),
    } as unknown as Response)

    await expect(postInvite({ code: 'WRONG' })).rejects.toMatchObject({
      error: 'invalid_code',
    })
  })
})
```

- [ ] **Step 4: Run client tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/api/client.test.ts
```

Expected: PASS — existing tests + 3 new tests.

- [ ] **Step 5: Write the Pinia store test file**

Create `packages/web/src/__tests__/stores/invite.test.ts`:

```ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { createPinia, setActivePinia } from 'pinia'
import { useInviteStore } from '../../stores/invite.js'
import type { ApiError } from '../../api/types.js'

vi.mock('../../api/client.js', () => ({
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

const { getInvite, postInvite } = await import('../../api/client.js')

describe('useInviteStore', () => {
  beforeEach(() => {
    setActivePinia(createPinia())
    vi.mocked(getInvite).mockReset()
    vi.mocked(postInvite).mockReset()
  })

  it('starts with accepted=null, phase=idle, error=null', () => {
    const store = useInviteStore()
    expect(store.accepted).toBeNull()
    expect(store.phase).toBe('idle')
    expect(store.error).toBeNull()
  })

  it('loadStatus sets accepted from server response', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })
    const store = useInviteStore()
    await store.loadStatus()
    expect(store.accepted).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('loadStatus on error sets phase=error and preserves prior accepted', async () => {
    const apiError: ApiError = { error: 'network', message: 'offline' }
    vi.mocked(getInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.loadStatus()
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBeNull() // unchanged from initial
  })

  it('submit with valid code sets accepted=true', async () => {
    vi.mocked(postInvite).mockResolvedValueOnce({ accepted: true })
    const store = useInviteStore()
    await store.submit('BETA-2026-ALPHA')
    expect(store.accepted).toBe(true)
    expect(store.phase).toBe('idle')
  })

  it('submit with wrong code sets phase=error, preserves accepted', async () => {
    const apiError: ApiError = {
      error: 'invalid_code',
      message: 'Invite code not recognized.',
    }
    vi.mocked(postInvite).mockRejectedValueOnce(apiError)
    const store = useInviteStore()
    await store.submit('WRONG-CODE')
    expect(store.phase).toBe('error')
    expect(store.error).toEqual(apiError)
    expect(store.accepted).toBeNull() // unchanged
  })
})
```

- [ ] **Step 6: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/stores/invite.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 7: Create the Pinia store**

Create `packages/web/src/stores/invite.ts`:

```ts
import { defineStore } from 'pinia'
import { ref } from 'vue'
import { getInvite, postInvite } from '../api/client.js'
import type { ApiError } from '../api/types.js'

type Phase = 'idle' | 'loading' | 'submitting' | 'error'

/**
 * Invite-flow state for the closed-beta gate.
 *
 * `accepted: boolean | null` distinguishes:
 * - `null` — haven't checked yet (App is loading)
 * - `false` — checked, not accepted (modal renders)
 * - `true` — checked, accepted (modal hidden, app proceeds)
 */
export const useInviteStore = defineStore('invite', () => {
  const accepted = ref<boolean | null>(null)
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

- [ ] **Step 8: Verify the store tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/stores/invite.test.ts
```

Expected: PASS — 5 tests.

- [ ] **Step 9: Run full workspace verification**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
```

Both green.

- [ ] **Step 10: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/web/src/api/types.ts packages/web/src/api/client.ts packages/web/src/__tests__/api/client.test.ts packages/web/src/stores/invite.ts packages/web/src/__tests__/stores/invite.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(web): invite types + getInvite/postInvite client + useInviteStore

Frontend foundation for P1b-6's gate UX. Three additions:

- ApiError.error union extended with 'invite_required' (gate's 403)
  and 'invalid_code' (route's 400 on wrong code).
- API client: getInvite() and postInvite(body) following the existing
  fetchJson pattern.
- useInviteStore Pinia store with tri-state accepted: boolean | null
  (null = unchecked, false = render modal, true = hidden), phase,
  error, loadStatus(), submit(code).

Tests: 3 new client tests (GET happy path, PUT happy path, 400
invalid_code envelope) plus 5 store tests (initial state, load happy
path, load error, submit happy path, submit wrong code preserves
accepted).

Not yet rendered — Task 5 adds InviteGate.vue, Task 6 wires it into
App.vue.

P1b-6 layer 4 of 6 (web foundation).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 5: `InviteGate.vue` modal component

**Files:**

- Create: `packages/web/src/components/InviteGate.vue`
- Create: `packages/web/src/__tests__/components/InviteGate.test.ts`

Full-page overlay with code input, submit button, error display.

- [ ] **Step 1: Write the failing test file**

Create `packages/web/src/__tests__/components/InviteGate.test.ts`:

```ts
import { describe, it, expect, vi } from 'vitest'
import { mount } from '@vue/test-utils'
import { createTestingPinia } from '@pinia/testing'
import InviteGate from '../../components/InviteGate.vue'
import { useInviteStore } from '../../stores/invite.js'
import type { ApiError } from '../../api/types.js'

function mountGate() {
  return mount(InviteGate, {
    global: {
      plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
    },
  })
}

describe('InviteGate', () => {
  it('renders the form with input and submit button', () => {
    const wrapper = mountGate()
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="invite-input"]').exists()).toBe(true)
    expect(wrapper.find('[data-testid="invite-submit"]').exists()).toBe(true)
    expect(wrapper.text()).toContain('Welcome to Lovelacer')
  })

  it('submit button is disabled when input is empty', () => {
    const wrapper = mountGate()
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
  })

  it('submit button is enabled when input has a value', async () => {
    const wrapper = mountGate()
    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(false)
  })

  it('submit button is disabled while phase=submitting', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    store.$patch({ phase: 'submitting' })
    await wrapper.vm.$nextTick()
    const btn = wrapper.find('[data-testid="invite-submit"]')
    expect((btn.element as HTMLButtonElement).disabled).toBe(true)
    expect(wrapper.text()).toContain('Checking…')
  })

  it('submit calls invite.submit with the typed code', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const submitSpy = vi.spyOn(store, 'submit').mockResolvedValueOnce(undefined)

    await wrapper.find('[data-testid="invite-input"]').setValue('BETA-2026-ALPHA')
    await wrapper.find('form').trigger('submit')

    expect(submitSpy).toHaveBeenCalledWith('BETA-2026-ALPHA')
  })

  it('shows error message on phase=error with invalid_code', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const apiError: ApiError = {
      error: 'invalid_code',
      message: 'Invite code not recognized.',
    }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    const errorEl = wrapper.find('[data-testid="invite-error"]')
    expect(errorEl.exists()).toBe(true)
    expect(errorEl.text()).toContain("That invite code wasn't recognized")
  })

  it('shows network error message on phase=error with network error', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    const apiError: ApiError = { error: 'network', message: 'offline' }
    store.$patch({ phase: 'error', error: apiError })

    await wrapper.vm.$nextTick()
    expect(wrapper.find('[data-testid="invite-error"]').text()).toContain('Could not reach the server')
  })

  it('preserves typed code after a wrong-code submission', async () => {
    const wrapper = mountGate()
    const store = useInviteStore()
    vi.spyOn(store, 'submit').mockImplementationOnce(async () => {
      store.$patch({
        phase: 'error',
        error: { error: 'invalid_code', message: 'nope' },
      })
    })

    await wrapper.find('[data-testid="invite-input"]').setValue('TYPO-CODE')
    await wrapper.find('form').trigger('submit')
    await wrapper.vm.$nextTick()

    const input = wrapper.find('[data-testid="invite-input"]')
    expect((input.element as HTMLInputElement).value).toBe('TYPO-CODE')
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/components/InviteGate.test.ts
```

Expected: FAIL — module not found.

- [ ] **Step 3: Create the component**

Create `packages/web/src/components/InviteGate.vue`:

```vue
<script setup lang="ts">
import { ref, computed } from 'vue'
import { useInviteStore } from '../stores/invite.js'

const invite = useInviteStore()
const code = ref('')

const isSubmitting = computed(() => invite.phase === 'submitting')

const errorMessage = computed(() => {
  if (invite.phase !== 'error' || invite.error === null) return ''
  if (invite.error.error === 'invalid_code') {
    return "That invite code wasn't recognized. Double-check the code or contact the project owner."
  }
  if (invite.error.error === 'invalid_body') return 'Please enter your invite code.'
  if (invite.error.error === 'network') return 'Could not reach the server. Try again in a moment.'
  return invite.error.message
})

async function onSubmit(e: Event) {
  e.preventDefault()
  await invite.submit(code.value)
}
</script>

<template>
  <div
    data-testid="invite-gate"
    class="fixed inset-0 z-50 flex items-center justify-center bg-stone-900/60 backdrop-blur-sm"
  >
    <form
      class="w-full max-w-md rounded-lg border border-stone-200 bg-white p-6 shadow-xl"
      @submit="onSubmit"
    >
      <h2 class="text-xl font-semibold text-stone-900">Welcome to Lovelacer</h2>
      <p class="mt-2 text-sm text-stone-600">
        Lovelacer is in closed beta. Enter your invite code to continue.
      </p>

      <label for="invite-code" class="mt-5 block text-xs font-medium text-stone-700">
        Invite code
      </label>
      <input
        id="invite-code"
        v-model="code"
        data-testid="invite-input"
        type="text"
        autocomplete="off"
        autocapitalize="off"
        spellcheck="false"
        :disabled="isSubmitting"
        class="mt-1 w-full rounded border border-stone-300 px-3 py-2 font-mono text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 disabled:opacity-50"
        placeholder="BETA-2026-XXXX"
      />

      <p
        v-if="errorMessage !== ''"
        data-testid="invite-error"
        class="mt-2 text-xs text-red-700"
      >
        {{ errorMessage }}
      </p>

      <button
        data-testid="invite-submit"
        type="submit"
        class="mt-5 w-full rounded bg-brand-600 px-4 py-2 text-sm font-medium text-white hover:bg-brand-700 disabled:cursor-not-allowed disabled:opacity-50"
        :disabled="isSubmitting || code.length === 0"
      >
        {{ isSubmitting ? 'Checking…' : 'Continue' }}
      </button>
    </form>
  </div>
</template>
```

- [ ] **Step 4: Verify the component tests pass**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/components/InviteGate.test.ts
```

Expected: PASS — 8 tests.

- [ ] **Step 5: Run full workspace verification**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
```

Both green.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/web/src/components/InviteGate.vue packages/web/src/__tests__/components/InviteGate.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(web): InviteGate modal component

Full-page overlay (fixed inset-0 z-50, dimmed backdrop) with:
- Welcome heading + brief explanation
- Single text input for the invite code
- Submit button (disabled when input empty or while submitting)
- Error display below input (friendly copy per error type:
  invalid_code, invalid_body, network, fallback)

Behavior:
- Code preserved after wrong-code submission so user can retype
- Form submits via submit event with e.preventDefault()
- Submit button shows "Checking…" while phase === 'submitting'

Eight component tests cover render, disabled states (empty input,
submitting), submit dispatch, error message variants, and code
preservation after a failed submission.

Not yet wired into App.vue — Task 6 adds the v-if="accepted ===
false" overlay and the loadStatus on-mount call.

P1b-6 layer 5 of 6 (modal component).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## Task 6: Wire `InviteGate` into App.vue + integration tests

**Files:**

- Modify: `packages/web/src/App.vue`
- Modify: `packages/web/src/__tests__/App.test.ts`

Final wiring layer. App calls `loadStatus()` on mount; renders `<InviteGate>` overlay when `accepted === false`.

- [ ] **Step 1: Read the existing App.vue**

```bash
cat /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow/packages/web/src/App.vue
```

Note the existing imports, watcher, and template structure.

- [ ] **Step 2: Update App.vue**

Read `packages/web/src/App.vue`. Add the import + the gate wiring. The result should look like:

```vue
<script setup lang="ts">
import { onMounted, watch } from 'vue'
import HealthBar from './components/HealthBar.vue'
import AnalyzeButton from './components/AnalyzeButton.vue'
import RoomList from './components/RoomList.vue'
import MiscBucket from './components/MiscBucket.vue'
import OverridesBar from './components/OverridesBar.vue'
import DashboardPreview from './components/DashboardPreview.vue'
import ApplyBar from './components/ApplyBar.vue'
import InviteGate from './components/InviteGate.vue'
import { useAnalyzeStore } from './stores/analyze.js'
import { useOverridesStore } from './stores/overrides.js'
import { useInviteStore } from './stores/invite.js'

const analyze = useAnalyzeStore()
const overrides = useOverridesStore()
const invite = useInviteStore()

onMounted(() => {
  void invite.loadStatus()
})

let loadedOnce = false
watch(
  () => analyze.phase,
  (phase) => {
    if (phase === 'ready' && !loadedOnce) {
      loadedOnce = true
      void overrides.loadFromServer()
    }
  },
)
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

    <section v-if="analyze.phase === 'ready' && analyze.preview !== null" class="space-y-4">
      <RoomList :rooms="analyze.preview.rooms" />
      <MiscBucket :misc="analyze.preview.misc" />
      <OverridesBar />
      <DashboardPreview :config="analyze.preview.config" />
      <ApplyBar />
    </section>
  </main>

  <InviteGate v-if="invite.accepted === false" />
</template>
```

The `<InviteGate v-if="invite.accepted === false">` sits OUTSIDE `<main>` so its overlay covers the full page. `accepted === null` (initial load) hides it; `accepted === true` (after submit) hides it. Only the explicit `false` renders it.

- [ ] **Step 3: Update App.test.ts with the gate integration tests**

Read `packages/web/src/__tests__/App.test.ts`. Update the mock block to include `getInvite` and `postInvite`:

```ts
vi.mock('../api/client.js', () => ({
  postPreview: vi.fn(),
  postApply: vi.fn(),
  getOverrides: vi.fn(),
  putOverrides: vi.fn(),
  getInvite: vi.fn(),
  postInvite: vi.fn(),
}))

const { postPreview, getOverrides, putOverrides, getInvite } = await import('../api/client.js')
```

In the existing `beforeEach`, add the new mock reset and a default `accepted: true`:

```ts
beforeEach(() => {
  vi.mocked(postPreview).mockReset()
  vi.mocked(getOverrides).mockReset()
  vi.mocked(putOverrides).mockReset()
  vi.mocked(getInvite).mockReset()
  // Default: most existing tests assume the gate is already accepted.
  // Tests that need accepted=false will override this.
  vi.mocked(getInvite).mockResolvedValue({ accepted: true })
})
```

(This default makes existing tests keep passing — they don't expect the gate modal.)

Append a new describe block at the end of the file:

```ts
describe('App invite gate', () => {
  it('calls invite.loadStatus on mount', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await wrapper.vm.$nextTick()

    expect(getInvite).toHaveBeenCalledOnce()
  })

  it('renders InviteGate when accepted === false', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: false })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(true)
  })

  it('does not render InviteGate when accepted === true', async () => {
    vi.mocked(getInvite).mockResolvedValueOnce({ accepted: true })

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })
    await Promise.resolve()
    await wrapper.vm.$nextTick()

    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
  })

  it('does not render InviteGate while accepted === null (loading state)', () => {
    // Don't resolve the mock; accepted stays null.
    vi.mocked(getInvite).mockReturnValue(new Promise(() => {})) // never resolves

    const wrapper = mount(App, {
      global: {
        plugins: [createTestingPinia({ stubActions: false, createSpy: vi.fn })],
      },
    })

    // Synchronously: no modal yet because we haven't resolved.
    expect(wrapper.find('[data-testid="invite-gate"]').exists()).toBe(false)
  })
})
```

- [ ] **Step 4: Run the App tests**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow vitest run packages/web/src/__tests__/App.test.ts
```

Expected: PASS — existing tests still pass (because the default mock is `{ accepted: true }`) plus 4 new tests.

- [ ] **Step 5: Run full workspace verification + format + lint**

```bash
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow typecheck
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow -r test
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow format:check
pnpm --dir /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow lint
```

All four green. If `format:check` fails, run `pnpm --dir <worktree> format`, re-stage, and retry.

- [ ] **Step 6: Commit**

```bash
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow add packages/web/src/App.vue packages/web/src/__tests__/App.test.ts
git -C /Users/akadlec/Development/Studio81Labs/lovelacer/.worktrees/p1b-6-invite-flow commit -m "$(cat <<'EOF'
feat(web): wire InviteGate into App + loadStatus on mount

Final P1b-6 layer. App.vue gains:
- onMounted hook that calls invite.loadStatus() once at startup
- <InviteGate v-if="invite.accepted === false" /> overlay outside
  <main>, so it covers the full page when the user hasn't accepted

The strict false check means the modal stays hidden during the
initial load (accepted === null). Once loadStatus resolves with
{ accepted: false }, the modal appears. Once user submits a valid
code, store updates accepted = true and modal disappears.

Existing App tests updated to mock getInvite as resolving { accepted:
true } in beforeEach so they continue to exercise their happy paths
without the modal in the way. Four new gate integration tests pin
the loadStatus-on-mount call, modal-renders-when-false, modal-hidden-
when-true, and modal-hidden-during-loading-state behaviors.

Closes P1b-6 (and P1b!).

Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>
EOF
)"
```

---

## P1b-6 Acceptance Confirmation

- [ ] `ACCEPTED_INVITE_CODES` and `isValidInviteCode()` in `packages/server/src/invite-codes.ts`.
- [ ] `InviteStore` class with `isAccepted`, `accept`, `close` methods. Single-row schema with CHECK constraint. WAL mode.
- [ ] `:memory:` for tests; mkdirSync for file paths.
- [ ] `GET /api/invite` returns `{ accepted: boolean }`.
- [ ] `POST /api/invite` validates body via zod, calls `isValidInviteCode`, persists via `InviteStore.accept` on success.
- [ ] 400 `invalid_code` on wrong code; 400 `invalid_body` on bad body; 500 `storage_error` on DB exceptions.
- [ ] Fastify `onRequest` hook gates `/api/*` (except `/api/health` and `/api/invite`) with 403 `invite_required` until accepted.
- [ ] `createApp` accepts `invite: InviteStore` in options and registers the new route plugin + hook.
- [ ] `main.ts` instantiates `InviteStore`, closes in shutdown alongside `OverrideStore`.
- [ ] Frontend: `getInvite` and `postInvite` API client functions.
- [ ] `ApiError.error` union extended with `'invite_required'` and `'invalid_code'`.
- [ ] `useInviteStore` Pinia store with `accepted: boolean | null` tri-state.
- [ ] `InviteGate.vue` modal — full-page overlay, code input, submit button, error display.
- [ ] `App.vue` calls `invite.loadStatus()` on mount; renders `<InviteGate>` when `accepted === false`.
- [ ] Tests: 8 invite-codes + 6 InviteStore + 7 invite route + 8 gate hook + 3 client + 5 store + 8 component + 4 App integration = 49 new tests.
- [ ] `pnpm typecheck`, `pnpm -r test`, `pnpm format:check`, `pnpm lint` all clean.
