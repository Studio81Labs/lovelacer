import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import { initSqliteStore, type SqliteSource } from './sqlite.js'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS latest_analysis (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    analysis    TEXT    NOT NULL,
    analyzed_at INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

interface LatestAnalysisRow {
  analysis: string
  analyzed_at: number
}

export interface LatestAnalysis<T = unknown> {
  analysis: T
  analyzedAt: number
}

/**
 * Single-row cache for the most recent generated preview. Overrides remain
 * owned by OverrideStore; Start over clears only browser state so this cache
 * can restore the last completed analysis on the next app load.
 */
export class LatestAnalysisStore {
  private readonly db: DatabaseType
  private readonly closeDb: () => void
  private readonly stmtGet: Statement
  private readonly stmtSave: Statement
  private readonly stmtClear: Statement

  constructor(source: SqliteSource) {
    const initialized = initSqliteStore(source, SCHEMA)
    this.db = initialized.db
    this.closeDb = initialized.close

    this.stmtGet = this.db.prepare('SELECT analysis, analyzed_at FROM latest_analysis WHERE id = 1')
    this.stmtSave = this.db.prepare(
      'INSERT OR REPLACE INTO latest_analysis (id, analysis, analyzed_at) ' +
        'VALUES (1, ?, unixepoch())',
    )
    this.stmtClear = this.db.prepare('DELETE FROM latest_analysis WHERE id = 1')
  }

  get<T = unknown>(): LatestAnalysis<T> | null {
    const row = this.stmtGet.get() as LatestAnalysisRow | undefined
    if (row === undefined) return null
    return {
      analysis: JSON.parse(row.analysis) as T,
      analyzedAt: row.analyzed_at,
    }
  }

  save<T>(analysis: T): void {
    this.stmtSave.run(JSON.stringify(analysis))
  }

  clear(): void {
    this.stmtClear.run()
  }

  close(): void {
    this.closeDb()
  }
}
