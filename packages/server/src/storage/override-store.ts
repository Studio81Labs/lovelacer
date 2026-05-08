import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { Override } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS overrides (
    entity_id   TEXT    PRIMARY KEY,
    room_id     TEXT,
    hidden      INTEGER NOT NULL DEFAULT 0,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch()),
    CHECK (room_id IS NOT NULL OR hidden = 1)
  );
`

interface OverrideRow {
  entity_id: string
  room_id: string | null
  hidden: number
}

/**
 * SQLite-backed persistence for per-entity user overrides.
 *
 * Single-tenant — one DB file per add-on install. Methods are synchronous
 * because better-sqlite3 is synchronous; that's a deliberate library
 * choice for low-volume single-writer workloads.
 *
 * Constructor accepts ':memory:' for tests so each test gets an isolated
 * DB. For file paths, the parent dir is created if missing.
 */
export class OverrideStore {
  private readonly db: DatabaseType
  private readonly stmtGetAll: Statement
  private readonly stmtDeleteAll: Statement
  private readonly stmtInsert: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename, { timeout: 5000 })
    this.db.pragma('journal_mode = WAL')
    this.db.exec(SCHEMA)

    this.stmtGetAll = this.db.prepare(
      'SELECT entity_id, room_id, hidden FROM overrides ORDER BY entity_id',
    )
    this.stmtDeleteAll = this.db.prepare('DELETE FROM overrides')
    this.stmtInsert = this.db.prepare(
      'INSERT INTO overrides (entity_id, room_id, hidden) VALUES (@entity_id, @room_id, @hidden)',
    )
  }

  /**
   * Returns all overrides ordered by entity_id ascending so the API
   * response is deterministic and easy to diff in tests / by humans.
   */
  getAll(): Override[] {
    const rows = this.stmtGetAll.all() as OverrideRow[]
    return rows.map((row) => rowToOverride(row))
  }

  /**
   * Replaces the entire overrides table contents in a single
   * transaction. If any insert fails (e.g., CHECK constraint violation),
   * the whole transaction rolls back and the previous contents are
   * preserved.
   */
  replaceAll(overrides: Override[]): void {
    const tx = this.db.transaction((items: Override[]) => {
      this.stmtDeleteAll.run()
      for (const o of items) {
        this.stmtInsert.run({
          entity_id: o.entityId,
          room_id: o.roomId ?? null,
          hidden: o.hidden === true ? 1 : 0,
        })
      }
    })
    tx(overrides)
  }

  /** Closes the underlying DB. Used in tests to release ':memory:' handles. */
  close(): void {
    this.db.close()
  }
}

function rowToOverride(row: OverrideRow): Override {
  const o: Override = { entityId: row.entity_id }
  if (row.room_id !== null) {
    // Cast is safe because the write path validates roomId against
    // CANONICAL_ROOMS (zod enum on PUT /api/overrides). Anything in
    // the DB is canonical by construction.
    o.roomId = row.room_id as NonNullable<Override['roomId']>
  }
  if (row.hidden === 1) o.hidden = true
  return o
}
