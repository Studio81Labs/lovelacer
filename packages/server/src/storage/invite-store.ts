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
    this.db = new Database(filename, { timeout: 5000 })
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
