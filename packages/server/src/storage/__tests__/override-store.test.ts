import { existsSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { describe, it, expect, afterEach } from 'vitest'
import type { Override } from '@lovelacer/shared'
import { OverrideStore } from '../override-store.js'

let store: OverrideStore | null = null

afterEach(() => {
  store?.close()
  store = null
})

function makeStore(): OverrideStore {
  store = new OverrideStore(':memory:')
  return store
}

describe('OverrideStore', () => {
  it('getAll on empty DB returns empty array', () => {
    const s = makeStore()
    expect(s.getAll()).toEqual([])
  })

  it('replaceAll([]) on empty DB stays empty', () => {
    const s = makeStore()
    s.replaceAll([])
    expect(s.getAll()).toEqual([])
  })

  it('round-trip: roomId-only override', () => {
    const s = makeStore()
    const overrides: Override[] = [
      { entityId: 'light.kitchen_ceiling', roomId: 'living_room' },
    ]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('round-trip: hidden-only override', () => {
    const s = makeStore()
    const overrides: Override[] = [{ entityId: 'sensor.diagnostic', hidden: true }]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('round-trip: combined roomId + hidden override', () => {
    const s = makeStore()
    const overrides: Override[] = [
      { entityId: 'media_player.tv', roomId: 'bedroom', hidden: true },
    ]
    s.replaceAll(overrides)
    expect(s.getAll()).toEqual(overrides)
  })

  it('replaceAll wipes existing rows before inserting', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    s.replaceAll([{ entityId: 'c.d', hidden: true }])
    expect(s.getAll()).toEqual([{ entityId: 'c.d', hidden: true }])
  })

  it('replaceAll is atomic — rejects bad row, prior contents intact', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    expect(() =>
      // @ts-expect-error — deliberately bypass TS to trigger the SQL CHECK
      s.replaceAll([{ entityId: 'c.d', roomId: 'bedroom' }, { entityId: 'e.f' }]),
    ).toThrow()
    expect(s.getAll()).toEqual([{ entityId: 'a.b', roomId: 'kitchen' }])
  })

  it('does not return updated_at in the read shape', () => {
    const s = makeStore()
    s.replaceAll([{ entityId: 'a.b', roomId: 'kitchen' }])
    const result = s.getAll()
    expect(result[0]).toEqual({ entityId: 'a.b', roomId: 'kitchen' })
    expect(result[0]).not.toHaveProperty('updated_at')
    expect(result[0]).not.toHaveProperty('updatedAt')
  })

  it('returns multiple overrides ordered by entityId for deterministic API output', () => {
    const s = makeStore()
    s.replaceAll([
      { entityId: 'z.last', hidden: true },
      { entityId: 'a.first', roomId: 'kitchen' },
      { entityId: 'm.middle', roomId: 'bedroom' },
    ])
    const ids = s.getAll().map((o) => o.entityId)
    expect(ids).toEqual(['a.first', 'm.middle', 'z.last'])
  })

  it('creates parent directory recursively for file-based DBs', () => {
    const baseDir = join(tmpdir(), `override-store-test-${Date.now()}`)
    const filePath = join(baseDir, 'sub', 'lovelacer.sqlite')
    expect(existsSync(baseDir)).toBe(false)
    const s = new OverrideStore(filePath)
    try {
      expect(existsSync(join(baseDir, 'sub'))).toBe(true)
      // Sanity: the DB is functional.
      expect(s.getAll()).toEqual([])
    } finally {
      s.close()
      rmSync(baseDir, { recursive: true, force: true })
    }
  })
})
