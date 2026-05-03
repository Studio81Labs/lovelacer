import { mkdirSync } from 'node:fs'
import { dirname } from 'node:path'
import Database from 'better-sqlite3'
import type { Database as DatabaseType, Statement } from 'better-sqlite3'
import {
  DEFAULT_SETTINGS,
  SUPPORTED_CARD_PACKS,
  SUPPORTED_LANGUAGES,
  type Settings,
  type SettingsCardPack,
  type SettingsLanguage,
  type SettingsSections,
} from '@lovelacer/shared'

const SCHEMA = `
  CREATE TABLE IF NOT EXISTS settings (
    id          INTEGER PRIMARY KEY CHECK (id = 1),
    payload     TEXT    NOT NULL,
    updated_at  INTEGER NOT NULL DEFAULT (unixepoch())
  );
`

interface SettingsRow {
  payload: string
}

/**
 * SQLite-backed persistence for the user's P2-6 settings.
 *
 * Single-row table (CHECK id=1) — only the most recent settings are
 * retained. Mirrors `InviteStore` / `AppliedSnapshotStore`.
 *
 * `payload` is JSON-serialized so adding a new field (e.g., a future
 * `floorPlan: boolean` toggle) is a JSON shape change rather than a
 * SQL schema migration.
 *
 * `get()` returns DEFAULT_SETTINGS when:
 *   - No row exists yet (first run).
 *   - The stored payload is malformed JSON.
 *   - The parsed JSON doesn't match the `Settings` shape.
 *
 * Defense-in-depth: the route layer's Zod schema is the trust boundary
 * on writes, but a corrupt or downgrade-incompatible row must never
 * crash startup.
 */
export class SettingsStore {
  private readonly db: DatabaseType
  private readonly stmtGet: Statement
  private readonly stmtSave: Statement

  constructor(filename: string) {
    if (filename !== ':memory:') {
      mkdirSync(dirname(filename), { recursive: true })
    }
    this.db = new Database(filename)
    this.db.pragma('journal_mode = WAL')
    // SQLite DDL — better-sqlite3's exec(), not Node's child_process.exec.
    this.db.exec(SCHEMA)

    this.stmtGet = this.db.prepare('SELECT payload FROM settings WHERE id = 1')
    this.stmtSave = this.db.prepare(
      'INSERT OR REPLACE INTO settings (id, payload, updated_at) VALUES (1, ?, unixepoch())',
    )
  }

  /**
   * Returns the persisted settings, or DEFAULT_SETTINGS if no row exists
   * or the stored payload is malformed/wrong-shape.
   */
  get(): Settings {
    const row = this.stmtGet.get() as SettingsRow | undefined
    if (row === undefined) return DEFAULT_SETTINGS

    let parsed: unknown
    // console.warn rather than the pino logger because SettingsStore has
    // no injected logger and a corrupt-row fallback is rare enough that
    // constructor-injecting one feels overkill. The route layer's pino
    // instance handles all expected logging.
    try {
      parsed = JSON.parse(row.payload)
    } catch (err) {
      console.warn(
        '[SettingsStore] stored payload is malformed JSON; falling back to defaults',
        err,
      )
      return DEFAULT_SETTINGS
    }

    if (!isSettings(parsed)) {
      console.warn(
        '[SettingsStore] stored payload does not match Settings shape; falling back to defaults',
      )
      return DEFAULT_SETTINGS
    }
    return parsed
  }

  save(settings: Settings): void {
    this.stmtSave.run(JSON.stringify(settings))
  }

  /** Closes the underlying DB. Used in tests to release ':memory:' handles. */
  close(): void {
    this.db.close()
  }
}

/**
 * Hand-rolled type guard. Matches the `Settings` shape exactly. Avoids
 * dragging Zod into the storage layer (Zod lives in route validators).
 */
function isSettings(value: unknown): value is Settings {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>

  if (!isLanguage(v.language)) return false
  if (!isCardPack(v.cardPack)) return false
  if (!isSections(v.sections)) return false
  return true
}

function isLanguage(value: unknown): value is SettingsLanguage {
  return typeof value === 'string' && (SUPPORTED_LANGUAGES as readonly string[]).includes(value)
}

function isCardPack(value: unknown): value is SettingsCardPack {
  return typeof value === 'string' && (SUPPORTED_CARD_PACKS as readonly string[]).includes(value)
}

const SECTION_KEYS: ReadonlyArray<keyof SettingsSections> = [
  'welcome',
  'quickStats',
  'people',
  'roomsByFloor',
  'activeRooms',
  'scenes',
  'cameras',
]

function isSections(value: unknown): value is Settings['sections'] {
  if (typeof value !== 'object' || value === null) return false
  const v = value as Record<string, unknown>
  for (const k of SECTION_KEYS) {
    if (typeof v[k] !== 'boolean') return false
  }
  return true
}
