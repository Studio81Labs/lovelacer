import { describe, it, expect, afterEach } from 'vitest'
import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import Database from 'better-sqlite3'
import { InviteStore } from '../invite-store.js'

let store: InviteStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

function makeStore(): InviteStore {
  store = new InviteStore(':memory:')
  return store
}

describe('InviteStore', () => {
  it('isAccepted() on empty DB returns false', () => {
    const s = makeStore()
    expect(s.isAccepted()).toBe(false)
  })

  it('accept() then isAccepted() returns true', () => {
    const s = makeStore()
    s.accept('BETA-2026-ALPHA')
    expect(s.isAccepted()).toBe(true)
  })

  it('accept() is idempotent — re-accept replaces the row', () => {
    const filename = join(tmpdir(), `invite-store-test-${Date.now()}.sqlite`)
    const s = new InviteStore(filename)
    try {
      s.accept('BETA-2026-ALPHA')
      s.accept('BETA-2026-BRAVO')
      const raw = new Database(filename, { readonly: true })
      const rows = raw.prepare('SELECT id, code FROM invite_acceptance').all() as {
        id: number
        code: string
      }[]
      raw.close()
      expect(rows).toHaveLength(1)
      expect(rows[0]).toEqual({ id: 1, code: 'BETA-2026-BRAVO' })
    } finally {
      s.close()
      rmSync(filename, { force: true })
    }
  })

  it('schema CHECK rejects insert with id != 1', () => {
    const s = makeStore()
    const db = (s as unknown as { db: Database.Database }).db
    expect(() => {
      db.prepare('INSERT INTO invite_acceptance (id, code) VALUES (2, ?)').run('foo')
    }).toThrow()
  })

  it('accept() with empty string is allowed at the storage layer', () => {
    const s = makeStore()
    s.accept('')
    expect(s.isAccepted()).toBe(true)
  })

  it('creates parent directory recursively for file-based DBs', () => {
    const baseDir = join(tmpdir(), `invite-store-test-${Date.now()}`)
    const filePath = join(baseDir, 'sub', 'lovelacer.sqlite')
    expect(existsSync(baseDir)).toBe(false)
    const s = new InviteStore(filePath)
    try {
      expect(existsSync(join(baseDir, 'sub'))).toBe(true)
      expect(s.isAccepted()).toBe(false)
    } finally {
      s.close()
      rmSync(baseDir, { recursive: true, force: true })
    }
  })
})
