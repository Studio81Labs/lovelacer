import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database, { type Database as DatabaseType, type Statement } from 'better-sqlite3'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS onboarding (
    id           INTEGER PRIMARY KEY CHECK (id = 1),
    completed_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

interface OnboardingRow {
  completed_at: number
}

/**
 * Status returned by both `get()` and `complete()`.
 *
 * `completedAt` is `null` when no row exists yet (fresh install) and a
 * unix timestamp once the user has completed the wizard (via Apply
 * success or explicit Skip). Frontend gates `shouldShowWizard` on this.
 */
export interface OnboardingStatus {
  completedAt: number | null
}

/**
 * SQLite-backed persistence for the P2-7 onboarding wizard's "completed"
 * flag.
 *
 * Single-row table (CHECK id=1) — only one row ever exists. Absence of
 * row = wizard not yet completed (frontend shows it). Presence of row =
 * wizard completed (frontend skips it forever).
 *
 * `complete()` is idempotent via INSERT OR REPLACE — re-completing
 * updates the timestamp without raising a constraint error. Skip flow
 * and apply-success flow both call `complete()`; if both race they
 * collapse to last-write-wins on the timestamp, which is harmless.
 *
 * Constructor accepts ':memory:' for tests; for file paths, the parent
 * directory is created if missing. Mirrors InviteStore /
 * AppliedSnapshotStore.
 */
export class OnboardingStore {
  private readonly db: DatabaseType
  private readonly stmtGet: Statement
  private readonly stmtComplete: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename, { timeout: 5000 })
    this.db.pragma('journal_mode = WAL')
    // SQLite DDL — better-sqlite3's exec(), not Node's child_process.exec.
    this.db.exec(SCHEMA)

    this.stmtGet = this.db.prepare('SELECT completed_at FROM onboarding WHERE id = 1')
    this.stmtComplete = this.db.prepare(
      'INSERT OR REPLACE INTO onboarding (id, completed_at) VALUES (1, unixepoch())',
    )
  }

  /**
   * Returns the persisted onboarding status. `completedAt: null` when
   * no row exists yet (fresh install).
   */
  get(): OnboardingStatus {
    const row = this.stmtGet.get() as OnboardingRow | undefined
    if (row === undefined) return { completedAt: null }
    return { completedAt: row.completed_at }
  }

  /**
   * Marks onboarding as completed and returns the new status. Idempotent:
   * re-calling updates the timestamp without raising an error.
   */
  complete(): OnboardingStatus {
    this.stmtComplete.run()
    return this.get()
  }

  /** Closes the underlying DB. Used in tests to release ':memory:' handles. */
  close(): void {
    this.db.close()
  }
}
