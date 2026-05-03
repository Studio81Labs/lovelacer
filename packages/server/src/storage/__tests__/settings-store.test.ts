import { mkdtempSync, rmSync } from 'node:fs'
import Database from 'better-sqlite3'
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
