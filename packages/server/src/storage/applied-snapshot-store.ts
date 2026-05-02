import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { AppliedSnapshot, SnapshotAssignment } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS applied_snapshot (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    assignments TEXT    NOT NULL,
    config      TEXT    NOT NULL,
    applied_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

interface SnapshotRow {
  assignments: string
  config: string
  applied_at: number
}

/**
 * SQLite-backed persistence for the last-applied dashboard snapshot.
 *
 * Single-row table (CHECK id=1) — only the most recent apply is retained.
 * Diff history is out of scope for P2-1 (see spec "Out of scope").
 *
 * Constructor accepts ':memory:' for tests; for file paths, the parent
 * directory is created if missing. Mirrors `InviteStore`.
 */
export class AppliedSnapshotStore {
  private readonly db: DatabaseType
  private readonly stmtGet: Statement
  private readonly stmtSave: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)

    this.stmtGet = this.db.prepare(
      'SELECT assignments, config, applied_at FROM applied_snapshot WHERE id = 1',
    )
    this.stmtSave = this.db.prepare(
      'INSERT OR REPLACE INTO applied_snapshot (id, assignments, config, applied_at) ' +
        'VALUES (1, ?, ?, unixepoch())',
    )
  }

  get(): AppliedSnapshot | null {
    const row = this.stmtGet.get() as SnapshotRow | undefined
    if (row === undefined) return null
    return {
      assignments: JSON.parse(row.assignments) as SnapshotAssignment[],
      config: JSON.parse(row.config),
      appliedAt: row.applied_at,
    }
  }

  save(snapshot: Omit<AppliedSnapshot, 'appliedAt'>): void {
    this.stmtSave.run(JSON.stringify(snapshot.assignments), JSON.stringify(snapshot.config))
  }

  close(): void {
    this.db.close()
  }
}
