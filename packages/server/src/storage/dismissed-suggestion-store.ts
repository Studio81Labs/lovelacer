import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import type { SuggestionType } from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS dismissed_suggestions (
    entity_id       TEXT    NOT NULL,
    suggestion_type TEXT    NOT NULL,
    dismissed_at    INTEGER NOT NULL DEFAULT (unixepoch()),
    PRIMARY KEY (entity_id, suggestion_type)
  );
`

interface DismissedRow {
  entity_id: string
  suggestion_type: string
}

/**
 * SQLite-backed persistence for dismissed P2-5 suggestions.
 *
 * Multi-row table keyed `(entity_id, suggestion_type)` — matches the
 * granularity of the `Suggestion` shape (one row per dismissed suggestion).
 * INSERT OR REPLACE makes `dismiss()` idempotent (re-dismissing updates
 * the timestamp without raising a constraint error).
 *
 * Constructor accepts ':memory:' for tests; for file paths, the parent
 * directory is created if missing. Mirrors `OverrideStore` /
 * `AppliedSnapshotStore`.
 */
export class DismissedSuggestionStore {
  private readonly db: DatabaseType
  private readonly stmtGetAll: Statement
  private readonly stmtDismiss: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename, { timeout: 5000 })
    this.db.pragma('journal_mode = WAL')
    // SQLite DDL — better-sqlite3's exec(), not Node's child_process.exec.
    this.db.exec(SCHEMA)

    this.stmtGetAll = this.db.prepare(
      'SELECT entity_id, suggestion_type FROM dismissed_suggestions ORDER BY entity_id, suggestion_type',
    )
    this.stmtDismiss = this.db.prepare(
      'INSERT OR REPLACE INTO dismissed_suggestions (entity_id, suggestion_type, dismissed_at) ' +
        'VALUES (?, ?, unixepoch())',
    )
  }

  /**
   * Returns dismissals as a Set of "entityId|type" keys for O(1) lookup
   * by the suggestion engine. The serialization matches what
   * `computeSuggestions`'s dismissed-set filter expects.
   */
  getAllAsKeySet(): Set<string> {
    const rows = this.stmtGetAll.all() as DismissedRow[]
    const out = new Set<string>()
    for (const row of rows) out.add(`${row.entity_id}|${row.suggestion_type}`)
    return out
  }

  dismiss(entityId: string, type: SuggestionType): void {
    this.stmtDismiss.run(entityId, type)
  }

  /** Closes the underlying DB. Used in tests to release ':memory:' handles. */
  close(): void {
    this.db.close()
  }
}
