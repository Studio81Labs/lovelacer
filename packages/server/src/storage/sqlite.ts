import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'

export type SqliteDatabase = DatabaseType
export type SqliteSource = string | SqliteDatabase

export interface InitializedSqliteStore {
  db: SqliteDatabase
  close: () => void
}

export function openSqliteDatabase(filename: string): SqliteDatabase {
  if (filename !== ':memory:') {
    mkdirSync(dirname(filename), { recursive: true })
  }

  const db = new Database(filename)
  try {
    // Best-effort WAL upgrade: SQLite's default is rollback-journal,
    // which is correct (just lower-throughput) for a single-writer
    // workload. WAL needs an exclusive lock; if startup hits a stale
    // or contended lock, retry orchestration handles the later DDL
    // failure without leaking this connection.
    try {
      db.pragma('journal_mode = WAL')
    } catch (err) {
      if ((err as { code?: string })?.code !== 'SQLITE_BUSY') throw err
    }
    return db
  } catch (err) {
    db.close()
    throw err
  }
}

export function initSqliteStore(source: SqliteSource, schema: string): InitializedSqliteStore {
  if (typeof source !== 'string') {
    source.exec(schema)
    return { db: source, close: () => {} }
  }

  const db = openSqliteDatabase(source)
  try {
    db.exec(schema)
    return { db, close: () => db.close() }
  } catch (err) {
    db.close()
    throw err
  }
}
