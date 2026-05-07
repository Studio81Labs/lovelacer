import { mkdtempSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
import type { Database as DatabaseType } from 'better-sqlite3'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { DEFAULT_SETTINGS, type Settings } from '@lovelacer/shared'
import { SettingsStore } from '../settings-store.js'

describe('SettingsStore (in-memory)', () => {
  let store: SettingsStore

  beforeEach(() => {
    store = new SettingsStore(':memory:')
  })

  afterEach(() => {
    store.close()
  })

  it('returns DEFAULT_SETTINGS on a fresh store', () => {
    expect(store.get()).toEqual(DEFAULT_SETTINGS)
  })

  it('persists a saved settings shape and returns it on get()', () => {
    const next: Settings = {
      language: 'cs',
      cardPack: 'default',
      sections: {
        welcome: false,
        quickStats: true,
        people: true,
        roomsByFloor: true,
        activeRooms: true,
        scenes: false,
        cameras: true,
      },
      uiLanguage: 'en',
    }
    store.save(next)
    expect(store.get()).toEqual(next)
  })

  it('save twice with different shapes — second wins (idempotent INSERT OR REPLACE)', () => {
    const a: Settings = { ...DEFAULT_SETTINGS, language: 'en' }
    const b: Settings = { ...DEFAULT_SETTINGS, language: 'cs' }
    store.save(a)
    store.save(b)
    expect(store.get()).toEqual(b)
  })

  it('leaves uiLanguage undefined for legacy P2-6/P2-7 rows that lack the field', () => {
    // Manually insert a JSON row without `uiLanguage`, simulating a row
    // persisted before P2-9. `Settings.uiLanguage` is OPTIONAL by design:
    // when absent, the SPA preserves whatever locale `detectInitialLocale()`
    // picked. The store must therefore leave the field undefined rather
    // than substituting a default — substituting would falsely signal
    // "user has explicitly chosen this language" to the reconciliation
    // watcher and override browser-detected locales on every load.
    const db = (store as unknown as { db: DatabaseType }).db
    db.prepare('INSERT OR REPLACE INTO settings (id, payload) VALUES (1, ?)').run(
      JSON.stringify({
        language: 'en',
        cardPack: 'default',
        sections: {
          welcome: true,
          quickStats: true,
          people: true,
          roomsByFloor: true,
          activeRooms: true,
          scenes: true,
          cameras: true,
        },
      }),
    )
    const settings = store.get()
    expect(settings.uiLanguage).toBeUndefined()
    // The other fields from the legacy payload are preserved verbatim.
    expect(settings.language).toBe('en')
  })

  it('round-trips uiLanguage through save and get', () => {
    const next: Settings = {
      ...DEFAULT_SETTINGS,
      uiLanguage: 'cs',
    }
    store.save(next)
    expect(store.get().uiLanguage).toBe('cs')
  })
})

describe('SettingsStore (file-backed)', () => {
  let dir: string

  beforeEach(() => {
    dir = mkdtempSync(join(tmpdir(), 'ss-'))
  })

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true })
  })

  it('creates the parent directory if missing', () => {
    const filename = join(dir, 'nested', 'lovelacer.sqlite')
    const store = new SettingsStore(filename)
    try {
      store.save({ ...DEFAULT_SETTINGS, language: 'en' })
      expect(store.get().language).toBe('en')
    } finally {
      store.close()
    }
  })

  it('persists across instances', () => {
    const filename = join(dir, 'lovelacer.sqlite')
    const first = new SettingsStore(filename)
    first.save({ ...DEFAULT_SETTINGS, language: 'cs' })
    first.close()
    const second = new SettingsStore(filename)
    try {
      expect(second.get().language).toBe('cs')
    } finally {
      second.close()
    }
  })

  it('returns DEFAULT_SETTINGS when the stored row has malformed JSON', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const filename = join(dir, 'lovelacer.sqlite')
      // Open the DB directly, write a corrupt row, close.
      const raw = new Database(filename)
      raw.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)
      raw.prepare('INSERT INTO settings (id, payload) VALUES (1, ?)').run('{not valid json')
      raw.close()

      const store = new SettingsStore(filename)
      try {
        expect(store.get()).toEqual(DEFAULT_SETTINGS)
        expect(warnSpy).toHaveBeenCalled()
      } finally {
        store.close()
      }
    } finally {
      warnSpy.mockRestore()
    }
  })

  it('returns DEFAULT_SETTINGS when the stored row is well-formed JSON but wrong shape', () => {
    const warnSpy = vi.spyOn(console, 'warn').mockImplementation(() => {})
    try {
      const filename = join(dir, 'lovelacer.sqlite')
      const raw = new Database(filename)
      raw.exec(`
        CREATE TABLE IF NOT EXISTS settings (
          id INTEGER PRIMARY KEY CHECK (id = 1),
          payload TEXT NOT NULL,
          updated_at INTEGER NOT NULL DEFAULT (unixepoch())
        );
      `)
      raw
        .prepare('INSERT INTO settings (id, payload) VALUES (1, ?)')
        .run(JSON.stringify({ language: 'klingon', cardPack: 'default', sections: {} }))
      raw.close()

      const store = new SettingsStore(filename)
      try {
        expect(store.get()).toEqual(DEFAULT_SETTINGS)
        expect(warnSpy).toHaveBeenCalled()
      } finally {
        store.close()
      }
    } finally {
      warnSpy.mockRestore()
    }
  })
})
